"""Сообщения сервера на языке интерфейса.

Фронтенд передаёт язык заголовком X-Lang (ru | en); зависимость `use_lang` кладёт его
в контекстную переменную, а `msg()` возвращает текст на нужном языке.
"""

from __future__ import annotations

from contextvars import ContextVar

from fastapi import Request

_lang: ContextVar[str] = ContextVar("lang", default="ru")

MESSAGES: dict[str, tuple[str, str]] = {
    "login_required": ("Нужно войти в аккаунт", "Please sign in"),
    "bad_credentials": ("Неверный логин или пароль", "Wrong username or password"),
    "too_many": ("Слишком много попыток. Попробуйте через {minutes} мин.", "Too many attempts. Try again in {minutes} min."),
    "csrf": ("Запрос отклонён (CSRF)", "Request rejected (CSRF)"),
    "foreign_origin": ("Запрос с чужого сайта отклонён", "Cross-site request rejected"),
    "registration_off": ("Регистрация новых пользователей отключена", "Registration is disabled"),
    "username_taken": ("Такой логин уже занят", "This username is already taken"),
    "username_format": ("Логин: 3–40 символов — латинские буквы, цифры, точка, дефис, подчёркивание",
                        "Username: 3–40 characters — latin letters, digits, dot, hyphen, underscore"),
    "wrong_current_password": ("Текущий пароль указан неверно", "Current password is wrong"),
    "wrong_password": ("Пароль указан неверно", "Wrong password"),
    "unknown_word": ("Неизвестное слово", "Unknown word"),
    "unknown_lesson": ("Неизвестный урок", "Unknown lesson"),
    "not_found": ("Не найдено", "Not found"),
    "frontend_missing": ("Фронтенд не собран: выполните npm run build в папке frontend",
                         "Frontend is not built: run npm run build in the frontend folder"),
    "custom_limit": ("Слишком много своих слов (максимум {limit})", "Too many custom words (max {limit})"),
    "empty_word": ("Введите слово", "Enter a word"),
    # политика паролей
    "pwd_short": ("Пароль должен быть не короче {n} символов", "Password must be at least {n} characters"),
    "pwd_long": ("Пароль должен быть не длиннее {n} символов", "Password must be at most {n} characters"),
    "pwd_common": ("Это один из самых распространённых паролей — он есть в базах утечек",
                   "This is one of the most common passwords — it appears in data breaches"),
    "pwd_sequence": ("Пароль состоит из повторов или последовательности клавиш",
                     "The password is a repetition or a keyboard sequence"),
    "pwd_digits": ("Пароль только из цифр слишком простой — добавьте буквы",
                   "A digits-only password is too simple — add letters"),
    "pwd_word_digits": ("Популярное слово с цифрами легко подобрать — придумайте фразу из нескольких слов",
                        "A common word with digits is easy to guess — use a phrase of several words"),
    "pwd_username": ("Пароль не должен содержать логин", "The password must not contain the username"),
    "pwd_variety": ("В пароле слишком мало разных символов", "The password has too few different characters"),
}


def use_lang(request: Request) -> None:
    lang = (request.headers.get("x-lang") or "ru").lower()
    _lang.set("en" if lang.startswith("en") else "ru")


def msg(key: str, **kwargs) -> str:
    ru, en = MESSAGES[key]
    text = en if _lang.get() == "en" else ru
    return text.format(**kwargs) if kwargs else text
