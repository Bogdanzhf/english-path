"""Пароли, сессии, защита от перебора и CSRF.

* Пароли — scrypt (память-ёмкий алгоритм, устойчив к перебору на видеокартах)
  с индивидуальной солью. Старые хэши PBKDF2 проверяются и перехэшируются при входе.
* Сессия — случайный 256-битный токен в cookie HttpOnly + SameSite=Strict: JavaScript
  страницы не может его прочитать, а чужие сайты не могут отправить его в запросе.
  В базе хранится только SHA-256 от токена.
* Изменяющие запросы требуют заголовок X-Requested-With и совпадение Origin с хостом.
* Вход и регистрация ограничены по числу попыток с одного адреса и для одного логина.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import timedelta

from fastapi import Cookie, Depends, HTTPException, Request, Response, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from .config import settings
from .i18n import msg
from .db import User, UserSession, aware, get_session, utcnow

SESSION_COOKIE = "ep_session"
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "english-path"

SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**15, 8, 1
SCRYPT_MAXMEM = 64 * 1024 * 1024
# фиктивный хэш: проверяем пароль даже для несуществующего логина, чтобы время ответа
# не выдавало, зарегистрирован ли пользователь
_DUMMY_HASH: str | None = None


# ---------- пароли ----------


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=SCRYPT_N, r=SCRYPT_R, p=SCRYPT_P, maxmem=SCRYPT_MAXMEM, dklen=32)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, *rest = stored.split("$")
        if algo == "scrypt":
            n, r, p, salt, digest = rest
            candidate = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=int(n), r=int(r), p=int(p),
                                       maxmem=SCRYPT_MAXMEM, dklen=len(digest) // 2).hex()
        elif algo == "pbkdf2":  # формат первой версии
            iterations, salt, digest = rest
            candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations)).hex()
        else:
            return False
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(candidate, digest)


def needs_rehash(stored: str) -> bool:
    return not stored.startswith(f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}$")


def burn_time(password: str) -> None:
    global _DUMMY_HASH
    if _DUMMY_HASH is None:
        _DUMMY_HASH = hash_password(secrets.token_hex(8))
    verify_password(password, _DUMMY_HASH)


# ---------- ограничение частоты ----------


class RateLimiter:
    """Скользящее окно в памяти процесса (для одного сервера этого достаточно)."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key: str, window: float, now: float) -> deque[float]:
        q = self._hits[key]
        while q and q[0] <= now - window:
            q.popleft()
        return q

    def blocked(self, key: str, limit: int, window: float) -> int:
        """Сколько секунд ждать (0 — можно)."""
        now = time.monotonic()
        with self._lock:
            q = self._prune(key, window, now)
            return int(q[0] + window - now) + 1 if len(q) >= limit else 0

    def hit(self, key: str) -> None:
        with self._lock:
            self._hits[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        with self._lock:
            self._hits.pop(key, None)


limiter = RateLimiter()
LOGIN_IP_LIMIT = (20, 300)  # 20 неудачных попыток за 5 минут с одного адреса
LOGIN_USER_LIMIT = (5, 900)  # 5 неудачных попыток за 15 минут для одного логина
REGISTER_IP_LIMIT = (10, 3600)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def check_limit(key: str, limit: tuple[int, int]) -> None:
    wait = limiter.blocked(key, *limit)
    if wait:
        minutes = max(1, round(wait / 60))
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            msg("too_many", minutes=minutes),
            headers={"Retry-After": str(wait)},
        )


# ---------- сессии ----------


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def start_session(db: Session, user: User, request: Request, response: Response) -> None:
    token = secrets.token_urlsafe(32)
    db.add(UserSession(
        token_hash=_hash_token(token), user_id=user.id,
        expires_at=utcnow() + timedelta(days=settings.session_days),
        user_agent=(request.headers.get("user-agent") or "")[:120],
    ))
    # заодно убираем просроченные сессии
    db.execute(delete(UserSession).where(UserSession.expires_at < utcnow()))
    db.commit()
    response.set_cookie(
        SESSION_COOKIE, token, max_age=settings.session_days * 86400, httponly=True,
        secure=settings.https, samesite="strict", path="/api",
    )


def end_session(db: Session, token: str | None, response: Response) -> None:
    if token:
        db.execute(delete(UserSession).where(UserSession.token_hash == _hash_token(token)))
        db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/api", httponly=True, secure=settings.https, samesite="strict")


def end_all_sessions(db: Session, user: User) -> None:
    db.execute(delete(UserSession).where(UserSession.user_id == user.id))
    db.commit()


def current_user(
    ep_session: str | None = Cookie(default=None),
    db: Session = Depends(get_session),
) -> User:
    if ep_session and len(ep_session) <= 100:
        row = db.get(UserSession, _hash_token(ep_session))
        if row is not None and aware(row.expires_at) > utcnow():
            user = db.get(User, row.user_id)
            if user is not None:
                return user
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, msg("login_required"))


# ---------- CSRF ----------


def csrf_guard(request: Request) -> None:
    """Для изменяющих запросов: свой заголовок + Origin того же сайта.

    Браузер не даёт чужому сайту выставить нестандартный заголовок без CORS-разрешения,
    а CORS мы не разрешаем, поэтому подделать запрос с другой страницы нельзя.
    """
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return
    if request.headers.get(CSRF_HEADER) != CSRF_VALUE:
        raise HTTPException(status.HTTP_403_FORBIDDEN, msg("csrf"))
    origin = request.headers.get("origin")
    if origin:
        host = request.headers.get("host", "")
        if origin.split("://", 1)[-1] != host:
            raise HTTPException(status.HTTP_403_FORBIDDEN, msg("foreign_origin"))
