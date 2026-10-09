"""HTTP API платформы English Path.

Учебный контент отдаётся фронтенду статическими JSON-файлами (data/*.json), упражнения
генерируются и проверяются в браузере. Сервер отвечает за аккаунты и хранение прогресса:
разделы курса, личный словарь и интервальное повторение, свои слова, результаты тестов, активность.
"""

from __future__ import annotations

import json
import re
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware

from . import passwords, srs
from .config import settings
from .content import get_library
from .db import Activity, CustomWord, LessonProgress, TestResult, User, WordProgress, aware, get_session, init_db, utcnow
from .i18n import msg, use_lang
from .security import (
    LOGIN_IP_LIMIT,
    LOGIN_USER_LIMIT,
    REGISTER_IP_LIMIT,
    SESSION_COOKIE,
    burn_time,
    check_limit,
    client_ip,
    csrf_guard,
    current_user,
    end_all_sessions,
    end_session,
    hash_password,
    limiter,
    needs_rehash,
    start_session,
    verify_password,
)

PASS_PERCENT = 70
CUSTOM_LIMIT = 5000
AVATARS = ["🦊", "🐼", "🦉", "🐯", "🐺", "🦁", "🐧", "🐬", "🚀", "🎧", "📚", "⚡"]
USERNAME_RE = re.compile(r"^[a-z0-9._-]{3,40}$")
CUSTOM_ID_RE = re.compile(r"^c:(\d{1,10})$")
PREF_KEYS = {"lang", "theme", "accent", "rate", "showRu", "sound", "autoplay", "suggestedLevel", "level", "dailyGoal"}


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    get_library()  # проверяем контент при старте
    yield


app = FastAPI(
    title="English Path API",
    lifespan=lifespan,
    dependencies=[Depends(use_lang), Depends(csrf_guard)],
    docs_url="/api/docs",
    redoc_url=None,
    openapi_url="/api/openapi.json",
)


# ---------- заголовки безопасности и кэширование ----------

CSP = (
    "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; "
    "font-src 'self'; script-src 'self'; connect-src 'self'; media-src 'self' blob:; "
    "manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; "
    "form-action 'self'; object-src 'none'"
)


class SecurityHeaders(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        h = response.headers
        h.setdefault("X-Content-Type-Options", "nosniff")
        h.setdefault("X-Frame-Options", "DENY")
        h.setdefault("Referrer-Policy", "same-origin")
        # микрофон нужен для упражнений на говорение
        h.setdefault("Permissions-Policy", "camera=(), microphone=(self), geolocation=(), payment=()")
        h.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        if settings.https:
            h.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
        if path.startswith("/api/docs"):
            return response  # Swagger UI грузит скрипты с CDN
        h.setdefault("Content-Security-Policy", CSP)
        if path.startswith("/api/"):
            h["Cache-Control"] = "no-store"
        elif path.startswith(("/assets/", "/img/", "/audio/")):
            h["Cache-Control"] = "public, max-age=31536000, immutable"
        else:
            h["Cache-Control"] = "no-cache"
        return response


app.add_middleware(SecurityHeaders)


@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    return JSONResponse({"detail": exc.detail}, status_code=exc.status_code, headers=exc.headers)


# ---------- схемы ----------


class RegisterIn(BaseModel):
    username: str = Field(min_length=3, max_length=40)
    password: str = Field(min_length=1, max_length=passwords.MAX_LENGTH)
    display_name: str = Field(default="", max_length=60)
    avatar: str = Field(default="🦊", max_length=16)

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        v = v.strip().lower()
        if not USERNAME_RE.fullmatch(v):
            raise ValueError(msg("username_format"))
        return v


class LoginIn(BaseModel):
    username: str = Field(max_length=40)
    password: str = Field(max_length=passwords.MAX_LENGTH)


class ProfileIn(BaseModel):
    display_name: str | None = Field(default=None, max_length=60)
    avatar: str | None = Field(default=None, max_length=16)


class PrefsIn(BaseModel):
    prefs: dict = Field(default_factory=dict)

    @field_validator("prefs")
    @classmethod
    def _prefs(cls, v: dict) -> dict:
        out = {k: v[k] for k in v if k in PREF_KEYS and isinstance(v[k], (str, int, float, bool))}
        if len(json.dumps(out)) > 2000:
            raise ValueError("prefs too large")
        return out


class PasswordChangeIn(BaseModel):
    current_password: str = Field(max_length=passwords.MAX_LENGTH)
    new_password: str = Field(max_length=passwords.MAX_LENGTH)


class DeleteAccountIn(BaseModel):
    password: str = Field(max_length=passwords.MAX_LENGTH)


class PasswordCheckIn(BaseModel):
    password: str = Field(max_length=passwords.MAX_LENGTH)
    username: str = Field(default="", max_length=40)


class LessonIn(BaseModel):
    key: str = Field(max_length=80)


class Review(BaseModel):
    id: str = Field(max_length=80)
    grade: int = Field(ge=0, le=3)


class ReviewsIn(BaseModel):
    reviews: list[Review] = Field(max_length=300)


class DictIn(BaseModel):
    ids: list[str] = Field(min_length=1, max_length=600)
    in_dict: bool


class CustomWordIn(BaseModel):
    word: str = Field(min_length=1, max_length=80)
    translation: str = Field(default="", max_length=200)
    ipa: str = Field(default="", max_length=80)
    example: str = Field(default="", max_length=300)
    note: str = Field(default="", max_length=300)

    @field_validator("word")
    @classmethod
    def _word(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError(msg("empty_word"))
        return v


class WordAnswer(BaseModel):
    id: str = Field(max_length=80)
    correct: bool


class ResultIn(BaseModel):
    kind: str = Field(pattern="^(vocab|reading|grammar|dialogue|unit|level|words|placement|game|listening|speaking|custom)$")
    scope: str = Field(max_length=120)
    title: str = Field(default="", max_length=160)
    score: int = Field(ge=0, le=1000)
    total: int = Field(ge=1, le=1000)
    words: list[WordAnswer] = Field(default_factory=list, max_length=300)

    @model_validator(mode="after")
    def _score(self):
        if self.score > self.total:
            raise ValueError("score > total")
        return self


# ---------- вспомогательное ----------


def user_out(user: User) -> dict:
    try:
        prefs = json.loads(user.prefs or "{}")
    except ValueError:
        prefs = {}
    return {"id": user.id, "username": user.username, "display_name": user.display_name, "avatar": user.avatar,
            "prefs": prefs}


def _lesson_row(db: Session, user: User, key: str) -> LessonProgress:
    row = db.scalar(select(LessonProgress).where(LessonProgress.user_id == user.id, LessonProgress.lesson_key == key))
    if row is None:
        row = LessonProgress(user_id=user.id, lesson_key=key, opened=False, best_score=0, completed=False)
        db.add(row)
    return row


def _word_row(db: Session, user: User, word_id: str) -> WordProgress:
    row = db.scalar(select(WordProgress).where(WordProgress.user_id == user.id, WordProgress.word_id == word_id))
    if row is None:
        row = WordProgress(user_id=user.id, word_id=word_id, in_dict=False, ease=2.5, interval=0, reps=0, lapses=0,
                           correct=0, wrong=0, due_at=utcnow(), added_at=utcnow())
        db.add(row)
    return row


def _check_word(db: Session, user: User, word_id: str) -> None:
    if word_id in get_library().words:
        return
    m = CUSTOM_ID_RE.fullmatch(word_id)
    if m and db.scalar(select(CustomWord.id).where(CustomWord.id == int(m.group(1)), CustomWord.user_id == user.id)):
        return
    raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{msg('unknown_word')}: {word_id}")


def _activity(db: Session, user: User, points: int) -> None:
    today = date.today().isoformat()
    row = db.scalar(select(Activity).where(Activity.user_id == user.id, Activity.day == today))
    if row is None:
        row = Activity(user_id=user.id, day=today, points=0)
        db.add(row)
    row.points = (row.points or 0) + max(0, points)


def _check_password_policy(password: str, username: str) -> None:
    errors = passwords.problems(password, username)
    if errors:
        raise HTTPException(422, errors[0])


def _custom_out(c: CustomWord) -> dict:
    return {"id": f"c:{c.id}", "word": c.word, "translation": c.translation, "ipa": c.ipa, "example": c.example,
            "note": c.note, "created_at": aware(c.created_at).isoformat()}


def _word_out(r: WordProgress) -> dict:
    return {"in_dict": r.in_dict, "ease": r.ease, "interval": r.interval, "reps": r.reps, "lapses": r.lapses,
            "correct": r.correct, "wrong": r.wrong, "due_at": aware(r.due_at).isoformat(),
            "seen_at": aware(r.seen_at).isoformat() if r.seen_at else None,
            "added_at": aware(r.added_at).isoformat() if r.added_at else None}


# ---------- служебное ----------


@app.get("/api/health")
def health():
    return {"ok": True, "registration": settings.allow_registration}


# ---------- авторизация ----------


@app.post("/api/auth/register")
def register(data: RegisterIn, request: Request, response: Response, db: Session = Depends(get_session)):
    if not settings.allow_registration:
        raise HTTPException(status.HTTP_403_FORBIDDEN, msg("registration_off"))
    ip_key = f"reg:{client_ip(request)}"
    check_limit(ip_key, REGISTER_IP_LIMIT)
    _check_password_policy(data.password, data.username)
    limiter.hit(ip_key)
    if db.scalar(select(User).where(User.username == data.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, msg("username_taken"))
    user = User(
        username=data.username,
        display_name=data.display_name.strip() or data.username,
        avatar=data.avatar if data.avatar in AVATARS else AVATARS[0],
        password_hash=hash_password(data.password),
        prefs="{}",
    )
    db.add(user)
    db.commit()
    start_session(db, user, request, response)
    return {"user": user_out(user)}


@app.post("/api/auth/login")
def login(data: LoginIn, request: Request, response: Response, db: Session = Depends(get_session)):
    username = data.username.strip().lower()
    ip_key, user_key = f"login-ip:{client_ip(request)}", f"login-user:{username}"
    check_limit(ip_key, LOGIN_IP_LIMIT)
    check_limit(user_key, LOGIN_USER_LIMIT)
    user = db.scalar(select(User).where(User.username == username))
    if user is None:
        burn_time(data.password)
    if user is None or not verify_password(data.password, user.password_hash):
        limiter.hit(ip_key)
        limiter.hit(user_key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, msg("bad_credentials"))
    limiter.reset(user_key)
    if needs_rehash(user.password_hash):
        user.password_hash = hash_password(data.password)
        db.commit()
    start_session(db, user, request, response)
    return {"user": user_out(user)}


@app.post("/api/auth/logout")
def logout(response: Response, ep_session: str | None = Cookie(default=None), db: Session = Depends(get_session)):
    end_session(db, ep_session, response)
    return {"ok": True}


@app.get("/api/auth/me")
def me(user: User = Depends(current_user)):
    return user_out(user)


@app.patch("/api/auth/me")
def update_me(data: ProfileIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    if data.display_name is not None and data.display_name.strip():
        user.display_name = data.display_name.strip()
    if data.avatar is not None and data.avatar in AVATARS:
        user.avatar = data.avatar
    db.add(user)
    db.commit()
    return user_out(user)


@app.put("/api/auth/prefs")
def update_prefs(data: PrefsIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    prefs = user_out(user)["prefs"]
    prefs.update(data.prefs)
    user.prefs = json.dumps(prefs, ensure_ascii=False)
    db.add(user)
    db.commit()
    return user_out(user)


@app.post("/api/auth/password")
def change_password(data: PasswordChangeIn, request: Request, response: Response,
                    user: User = Depends(current_user), db: Session = Depends(get_session)):
    key = f"pwd:{user.id}"
    check_limit(key, LOGIN_USER_LIMIT)
    if not verify_password(data.current_password, user.password_hash):
        limiter.hit(key)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, msg("wrong_current_password"))
    _check_password_policy(data.new_password, user.username)
    user.password_hash = hash_password(data.new_password)
    db.commit()
    end_all_sessions(db, user)  # выходим на всех устройствах и открываем новую сессию здесь
    start_session(db, user, request, response)
    return {"ok": True}


@app.post("/api/auth/delete")
def delete_account(data: DeleteAccountIn, response: Response, user: User = Depends(current_user),
                   db: Session = Depends(get_session)):
    if not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, msg("wrong_password"))
    db.delete(user)
    db.commit()
    response.delete_cookie(SESSION_COOKIE, path="/api")
    return {"ok": True}


@app.post("/api/auth/check-password")
def check_password(data: PasswordCheckIn):
    """Подсказка при вводе пароля (ничего не сохраняет)."""
    return {"problems": passwords.problems(data.password, data.username), "strength": passwords.strength(data.password)}


@app.get("/api/avatars")
def avatars():
    return AVATARS


# ---------- прогресс ----------


@app.get("/api/progress")
def progress(user: User = Depends(current_user), db: Session = Depends(get_session)):
    lessons = db.scalars(select(LessonProgress).where(LessonProgress.user_id == user.id))
    words = db.scalars(select(WordProgress).where(WordProgress.user_id == user.id))
    custom = db.scalars(select(CustomWord).where(CustomWord.user_id == user.id).order_by(CustomWord.id))
    results = db.scalars(
        select(TestResult).where(TestResult.user_id == user.id).order_by(TestResult.created_at.desc()).limit(300)
    )
    activity = db.scalars(select(Activity).where(Activity.user_id == user.id))
    return {
        "lessons": {r.lesson_key: {"opened": r.opened, "best_score": r.best_score, "completed": r.completed}
                    for r in lessons},
        "words": {r.word_id: _word_out(r) for r in words},
        "custom": [_custom_out(c) for c in custom],
        "results": [{"id": r.id, "kind": r.kind, "scope": r.scope, "title": r.title, "score": r.score,
                     "total": r.total, "created_at": aware(r.created_at).isoformat()} for r in results],
        "activity": {a.day: a.points for a in activity},
    }


@app.post("/api/progress/lesson")
def lesson_opened(data: LessonIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    if data.key not in get_library().lesson_keys:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, msg("unknown_lesson"))
    row = _lesson_row(db, user, data.key)
    if not row.opened:
        row.opened = True
        _activity(db, user, 2)
    db.commit()
    return {"ok": True}


@app.post("/api/progress/reviews")
def word_reviews(data: ReviewsIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    for r in data.reviews:
        _check_word(db, user, r.id)
    for r in data.reviews:
        srs.review(_word_row(db, user, r.id), r.grade)
    _activity(db, user, len(data.reviews))
    db.commit()
    return {"ok": True}


@app.post("/api/dict")
def set_in_dict(data: DictIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    """Добавить слова курса в личный словарь или убрать их оттуда."""
    for word_id in data.ids:
        _check_word(db, user, word_id)
    for word_id in dict.fromkeys(data.ids):
        row = _word_row(db, user, word_id)
        if data.in_dict and not row.in_dict:
            row.added_at = utcnow()
        row.in_dict = data.in_dict
    db.commit()
    return {"ok": True}


@app.post("/api/custom-words")
def add_custom(data: CustomWordIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    count = db.scalar(select(func.count()).select_from(CustomWord).where(CustomWord.user_id == user.id)) or 0
    if count >= CUSTOM_LIMIT:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, msg("custom_limit", limit=CUSTOM_LIMIT))
    c = CustomWord(user_id=user.id, **data.model_dump())
    db.add(c)
    db.flush()
    row = _word_row(db, user, f"c:{c.id}")
    row.in_dict = True
    db.commit()
    return _custom_out(c)


def _own_custom(db: Session, user: User, cid: int) -> CustomWord:
    c = db.scalar(select(CustomWord).where(CustomWord.id == cid, CustomWord.user_id == user.id))
    if c is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, msg("not_found"))
    return c


@app.put("/api/custom-words/{cid}")
def edit_custom(cid: int, data: CustomWordIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    c = _own_custom(db, user, cid)
    for k, v in data.model_dump().items():
        setattr(c, k, v)
    db.commit()
    return _custom_out(c)


@app.delete("/api/custom-words/{cid}")
def delete_custom(cid: int, user: User = Depends(current_user), db: Session = Depends(get_session)):
    c = _own_custom(db, user, cid)
    row = db.scalar(select(WordProgress).where(WordProgress.user_id == user.id, WordProgress.word_id == f"c:{cid}"))
    if row is not None:
        db.delete(row)
    db.delete(c)
    db.commit()
    return {"ok": True}


@app.post("/api/progress/result")
def save_result(data: ResultIn, user: User = Depends(current_user), db: Session = Depends(get_session)):
    for w in data.words:
        _check_word(db, user, w.id)
    percent = round(data.score * 100 / data.total)
    completed = False
    if data.kind in ("vocab", "reading", "grammar", "dialogue"):
        if data.scope not in get_library().lesson_keys:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, msg("unknown_lesson"))
        row = _lesson_row(db, user, data.scope)
        row.opened = True
        row.best_score = max(row.best_score or 0, percent)
        if percent >= PASS_PERCENT:
            row.completed = completed = True
    for w in data.words:
        srs.review(_word_row(db, user, w.id), srs.GOOD if w.correct else srs.AGAIN)
    db.add(TestResult(user_id=user.id, kind=data.kind, scope=data.scope, title=data.title or data.scope,
                      score=data.score, total=data.total))
    _activity(db, user, 10 + data.score)
    db.commit()
    return {"percent": percent, "passed": percent >= PASS_PERCENT, "completed": completed}


# ---------- фронтенд ----------

dist = settings.frontend_dist


@app.get("/{path:path}", include_in_schema=False)
def spa(path: str):
    if path.startswith("api/") or path == "api":
        raise HTTPException(status.HTTP_404_NOT_FOUND, msg("not_found"))
    if not dist.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, msg("frontend_missing"))
    root = dist.resolve()
    file = (root / path).resolve()
    if path and file.is_file() and root in file.parents:
        return FileResponse(file)
    if Path(path).suffix:  # отсутствующий файл, а не маршрут приложения
        raise HTTPException(status.HTTP_404_NOT_FOUND, msg("not_found"))
    return FileResponse(root / "index.html")
