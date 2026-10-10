"""Безопасность: пароли, хэши, перебор, CSRF, изоляция данных, заголовки, cookie."""

import pytest

from app import passwords
from app.security import hash_password, verify_password
from tests.conftest import GOOD_PASSWORD, WORD_ID, make_client


@pytest.mark.parametrize("pwd", ["test1234", "password", "Password1!", "qwerty123", "12345678", "iloveyou", "short"])
def test_weak_passwords_rejected(pwd):
    assert passwords.problems(pwd), pwd


@pytest.mark.parametrize("pwd", [GOOD_PASSWORD, "purple elephant on the balcony", "Xk7#pQ2!mZ9w"])
def test_strong_passwords_accepted(pwd):
    assert passwords.problems(pwd) == []


def test_password_must_not_contain_username():
    assert passwords.problems("oliver-rose-garden-9", "oliver")


def test_register_rejects_weak_password():
    with make_client() as c:
        assert c.post("/api/auth/register", json={"username": "weakuser", "password": "test1234"}).status_code == 422


def test_scrypt_hash():
    h = hash_password("Secret-Long-Phrase-123")
    assert h.startswith("scrypt$") and "Secret" not in h
    assert verify_password("Secret-Long-Phrase-123", h)
    assert not verify_password("secret-long-phrase-123", h)
    assert hash_password("x") != hash_password("x")  # соль
    assert not verify_password("x", "garbage")


def test_session_cookie_flags():
    with make_client() as c:
        r = c.post("/api/auth/register", json={"username": "cookieuser", "password": GOOD_PASSWORD})
        cookie = r.headers["set-cookie"].lower()
        assert "ep_session=" in cookie and "httponly" in cookie and "samesite=strict" in cookie
        assert "path=/api" in cookie


def test_csrf_header_required():
    with make_client() as c:
        c.headers.pop("X-Requested-With")
        r = c.post("/api/auth/register", json={"username": "nocsrf", "password": GOOD_PASSWORD})
        assert r.status_code == 403


def test_foreign_origin_rejected():
    with make_client() as c:
        r = c.post("/api/auth/register", json={"username": "evilorigin", "password": GOOD_PASSWORD},
                   headers={"Origin": "https://evil.example"})
        assert r.status_code == 403
        r = c.post("/api/auth/register", json={"username": "goodorigin", "password": GOOD_PASSWORD},
                   headers={"Origin": "http://testserver"})
        assert r.status_code == 200


def test_login_bruteforce_limited():
    with make_client() as c:
        c.post("/api/auth/register", json={"username": "victim", "password": GOOD_PASSWORD})
        c.post("/api/auth/logout")
        codes = [c.post("/api/auth/login", json={"username": "victim", "password": f"wrong-{i}"}).status_code
                 for i in range(8)]
        assert 429 in codes
        # даже верный пароль временно не пускает
        assert c.post("/api/auth/login", json={"username": "victim", "password": GOOD_PASSWORD}).status_code == 429


def test_users_cannot_see_each_others_progress(user_client):
    user_client.post("/api/dict", json={"ids": [WORD_ID], "in_dict": True})
    with make_client() as other:
        other.post("/api/auth/register", json={"username": "stranger", "password": GOOD_PASSWORD})
        assert other.get("/api/progress").json()["words"] == {}


def test_forged_session_cookie_rejected():
    with make_client() as c:
        c.cookies.set("ep_session", "forged-token-value", path="/api")
        assert c.get("/api/auth/me").status_code == 401


def test_security_headers(client):
    h = client.get("/api/health").headers
    assert h["x-content-type-options"] == "nosniff"
    assert h["x-frame-options"] == "DENY"
    assert "default-src 'self'" in h["content-security-policy"]
    assert "microphone=(self)" in h["permissions-policy"]
    assert h["cache-control"] == "no-store"


def test_prefs_size_limited(user_client):
    r = user_client.put("/api/auth/prefs", json={"prefs": {"theme": "x" * 5000}})
    assert r.status_code == 422


def test_review_batch_size_limited(user_client):
    reviews = [{"id": WORD_ID, "grade": 2}] * 301
    assert user_client.post("/api/progress/reviews", json={"reviews": reviews}).status_code == 422
