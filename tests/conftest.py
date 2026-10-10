import os
import tempfile
import uuid
from pathlib import Path

import pytest

_tmp = Path(tempfile.mkdtemp()) / "test.db"
os.environ["ENGLISH_PATH_DB"] = f"sqlite:///{_tmp.as_posix()}"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.security import limiter  # noqa: E402

CSRF = {"X-Requested-With": "english-path"}
GOOD_PASSWORD = "Violet-Harbour-Lantern-42"
WORD_ID = "a1.01.agree"  # первое слово первого юнита A1


def make_client() -> TestClient:
    c = TestClient(app, base_url="http://testserver")
    c.headers.update(CSRF)
    return c


@pytest.fixture(autouse=True)
def _reset_limits():
    limiter._hits.clear()
    yield
    limiter._hits.clear()


@pytest.fixture(scope="session")
def client():
    with make_client() as c:
        yield c


@pytest.fixture()
def user_client():
    """Новый пользователь со своей сессией (cookie)."""
    with make_client() as c:
        name = f"user_{uuid.uuid4().hex[:8]}"
        r = c.post("/api/auth/register", json={"username": name, "password": GOOD_PASSWORD, "display_name": "Алиса"})
        assert r.status_code == 200, r.text
        c.username = name
        yield c
