"""API: регистрация, профиль, прогресс, словарь, интервальное повторение, свои слова, результаты."""

from tests.conftest import GOOD_PASSWORD, WORD_ID, make_client


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200 and r.json()["ok"] is True


def test_register_login_logout_flow():
    with make_client() as c:
        r = c.post("/api/auth/register", json={"username": "Olivia", "password": GOOD_PASSWORD, "avatar": "🦉"})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["username"] == "olivia"
        assert r.json()["user"]["avatar"] == "🦉"
        assert c.get("/api/auth/me").json()["display_name"] == "olivia"

        assert c.post("/api/auth/logout").status_code == 200
        assert c.get("/api/auth/me").status_code == 401

        assert c.post("/api/auth/login", json={"username": "olivia", "password": "nope-nope"}).status_code == 401
        assert c.post("/api/auth/login", json={"username": "OLIVIA", "password": GOOD_PASSWORD}).status_code == 200
        assert c.get("/api/auth/me").status_code == 200

    with make_client() as other:
        assert other.post("/api/auth/register", json={"username": "olivia", "password": GOOD_PASSWORD}).status_code == 409


def test_bad_usernames_rejected():
    with make_client() as c:
        for name in ["ab", "with space", "кириллица", "x" * 41, "<script>"]:
            r = c.post("/api/auth/register", json={"username": name, "password": GOOD_PASSWORD})
            assert r.status_code == 422, name


def test_messages_follow_language_header():
    with make_client() as c:
        ru = c.post("/api/auth/login", json={"username": "nobody", "password": "x"}, headers={"X-Lang": "ru"})
        en = c.post("/api/auth/login", json={"username": "nobody", "password": "x"}, headers={"X-Lang": "en"})
        assert ru.status_code == en.status_code == 401
        assert ru.json()["detail"] != en.json()["detail"]
        assert any("а" <= ch <= "я" for ch in ru.json()["detail"].lower())


def test_progress_requires_auth():
    with make_client() as c:
        assert c.get("/api/progress").status_code == 401
        assert c.post("/api/dict", json={"ids": [WORD_ID], "in_dict": True}).status_code == 401


def test_lesson_opened_and_results(user_client):
    c = user_client
    assert c.post("/api/progress/lesson", json={"key": "v.a1.01"}).status_code == 200
    assert c.post("/api/progress/lesson", json={"key": "v.zz.99"}).status_code == 400

    r = c.post("/api/progress/result", json={"kind": "vocab", "scope": "v.a1.01", "title": "Unit 1",
                                             "score": 6, "total": 10})
    assert r.json() == {"percent": 60, "passed": False, "completed": False}
    r = c.post("/api/progress/result", json={"kind": "vocab", "scope": "v.a1.01", "score": 9, "total": 10,
                                             "words": [{"id": WORD_ID, "correct": True}]})
    assert r.json()["completed"] is True

    p = c.get("/api/progress").json()
    assert p["lessons"]["v.a1.01"] == {"opened": True, "best_score": 90, "completed": True}
    assert p["words"][WORD_ID]["reps"] == 1 and p["words"][WORD_ID]["correct"] == 1
    assert len(p["results"]) == 2
    assert sum(p["activity"].values()) > 0


def test_lesson_keys_for_all_kinds(user_client):
    c = user_client
    for key in ["v.c2.30", "r.b2.05", "g.a1.to-be", "g.c2.punctuation", "d.a2-at-the-doctor", "d.c2-book-club"]:
        r = c.post("/api/progress/lesson", json={"key": key})
        assert r.status_code == 200, (key, r.text)


def test_result_validation(user_client):
    c = user_client
    bad = [
        {"kind": "vocab", "scope": "v.a1.01", "score": 11, "total": 10},
        {"kind": "hack", "scope": "x", "score": 1, "total": 1},
        {"kind": "level", "scope": "a1", "score": 1, "total": 1, "words": [{"id": "nope", "correct": True}]},
        {"kind": "level", "scope": "a1", "score": 1, "total": 0},
        {"kind": "grammar", "scope": "g.zz.nothing", "score": 1, "total": 1},
    ]
    for body in bad:
        assert c.post("/api/progress/result", json=body).status_code in (400, 422), body
    ok = {"kind": "placement", "scope": "placement", "title": "B2", "score": 18, "total": 24}
    assert c.post("/api/progress/result", json=ok).status_code == 200


def test_reviews_follow_srs(user_client):
    c = user_client
    for _ in range(3):
        assert c.post("/api/progress/reviews", json={"reviews": [{"id": WORD_ID, "grade": 2}]}).status_code == 200
    w = c.get("/api/progress").json()["words"][WORD_ID]
    assert w["reps"] == 3 and w["correct"] == 3 and w["interval"] > 3
    c.post("/api/progress/reviews", json={"reviews": [{"id": WORD_ID, "grade": 0}]})
    w = c.get("/api/progress").json()["words"][WORD_ID]
    assert w["reps"] == 0 and w["interval"] == 0 and w["lapses"] == 1 and w["ease"] < 2.5
    assert c.post("/api/progress/reviews", json={"reviews": [{"id": WORD_ID, "grade": 7}]}).status_code == 422
    assert c.post("/api/progress/reviews", json={"reviews": [{"id": "x.y.z", "grade": 2}]}).status_code == 400


def test_personal_dictionary(user_client):
    c = user_client
    ids = [WORD_ID, "c2.30.paradox"]
    assert c.post("/api/dict", json={"ids": ids, "in_dict": True}).status_code == 200
    words = c.get("/api/progress").json()["words"]
    assert all(words[i]["in_dict"] and words[i]["added_at"] for i in ids)
    assert c.post("/api/dict", json={"ids": [WORD_ID], "in_dict": False}).status_code == 200
    assert c.get("/api/progress").json()["words"][WORD_ID]["in_dict"] is False
    assert c.post("/api/dict", json={"ids": ["no.such.word"], "in_dict": True}).status_code == 400


def test_custom_words_crud_and_isolation(user_client):
    c = user_client
    r = c.post("/api/custom-words", json={"word": "serendipity", "translation": "счастливая случайность",
                                          "example": "Meeting you was pure serendipity."})
    assert r.status_code == 200
    cw = r.json()
    wid = cw["id"]  # «c:<число>»
    cid = wid.split(":")[1]
    words = c.get("/api/progress").json()
    assert words["custom"][0]["word"] == "serendipity"
    assert words["words"][wid]["in_dict"] is True

    assert c.post("/api/progress/reviews", json={"reviews": [{"id": wid, "grade": 3}]}).status_code == 200
    r = c.put(f"/api/custom-words/{cid}", json={"word": "serendipity", "translation": "удачная случайность"})
    assert r.json()["translation"] == "удачная случайность"

    with make_client() as other:
        other.post("/api/auth/register", json={"username": "intruder1", "password": GOOD_PASSWORD})
        assert other.put(f"/api/custom-words/{cid}", json={"word": "hacked"}).status_code == 404
        assert other.delete(f"/api/custom-words/{cid}").status_code == 404
        assert other.post("/api/progress/reviews", json={"reviews": [{"id": wid, "grade": 2}]}).status_code == 400

    assert c.delete(f"/api/custom-words/{cid}").status_code == 200
    p = c.get("/api/progress").json()
    assert p["custom"] == [] and wid not in p["words"]


def test_profile_prefs_and_password(user_client):
    c = user_client
    assert c.patch("/api/auth/me", json={"display_name": "Маша", "avatar": "🐼"}).json()["avatar"] == "🐼"
    assert c.patch("/api/auth/me", json={"avatar": "<script>"}).json()["avatar"] == "🐼"

    r = c.put("/api/auth/prefs", json={"prefs": {"theme": "dark", "rate": 0.9, "evil": "x", "lang": "en"}})
    prefs = r.json()["prefs"]
    assert prefs["theme"] == "dark" and prefs["lang"] == "en" and "evil" not in prefs

    r = c.post("/api/auth/password", json={"current_password": "wrong", "new_password": "Nimbus-Garden-Velvet-77"})
    assert r.status_code == 400
    r = c.post("/api/auth/password", json={"current_password": GOOD_PASSWORD, "new_password": "password123"})
    assert r.status_code == 422
    r = c.post("/api/auth/password", json={"current_password": GOOD_PASSWORD, "new_password": "Nimbus-Garden-Velvet-77"})
    assert r.status_code == 200
    assert c.get("/api/auth/me").status_code == 200  # новая сессия выдана


def test_delete_account(user_client):
    c = user_client
    c.post("/api/dict", json={"ids": [WORD_ID], "in_dict": True})
    assert c.post("/api/auth/delete", json={"password": "wrong"}).status_code == 400
    assert c.post("/api/auth/delete", json={"password": GOOD_PASSWORD}).status_code == 200
    assert c.get("/api/auth/me").status_code == 401
    assert c.post("/api/auth/login", json={"username": c.username, "password": GOOD_PASSWORD}).status_code == 401


def test_password_check_hint(client):
    r = client.post("/api/auth/check-password", json={"password": "qwerty123"})
    assert r.json()["problems"]
    r = client.post("/api/auth/check-password", json={"password": GOOD_PASSWORD})
    assert r.json()["problems"] == [] and r.json()["strength"] >= 2


def test_avatars(client):
    assert "🦊" in client.get("/api/avatars").json()


def test_unknown_api_route_is_404(client):
    assert client.get("/api/nothing-here").status_code == 404
