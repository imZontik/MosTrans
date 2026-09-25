"""Small helpers to keep scenario content readable."""

from typing import Any

BEST, OK, BAD = "best", "ok", "bad"

VOVA = {"name": "Вова", "role": "поездной электромеханик", "avatar": "👨‍🔧"}
CHIEF = {"name": "Ирина Сергеевна", "role": "начальник поезда", "avatar": "👩‍✈️"}


def c(
    cid: str,
    text: str,
    next_: str,
    quality: str,
    points: int,
    feedback: str,
    *,
    loyalty: int = 0,
    safety: int = 0,
    tags: list[str] | None = None,
) -> dict:
    effects = {k: v for k, v in (("loyalty", loyalty), ("safety", safety)) if v}
    choice: dict[str, Any] = {
        "id": cid,
        "text": text,
        "next": next_,
        "quality": quality,
        "points": points,
        "effects": effects,
        "feedback": feedback,
    }
    if tags:
        choice["tags"] = tags
    return choice


def scene(speaker: str, text: str, next_: str, **extra: Any) -> dict:
    return {"type": "scene", "speaker": speaker, "text": text, "next": next_, **extra}


def choice(speaker: str, text: str, choices: list[dict], *, timer: int | None = None, timeout: dict | None = None, **extra: Any) -> dict:
    node: dict[str, Any] = {"type": "choice", "speaker": speaker, "text": text, "choices": choices, **extra}
    if timer:
        node["timer"] = timer
    if timeout:
        node["timeout"] = timeout
    return node


def timeout(next_: str, feedback: str, *, loyalty: int = 0, safety: int = 0) -> dict:
    return {"next": next_, "feedback": feedback, "effects": {"loyalty": loyalty, "safety": safety}}


def free_text(
    speaker: str,
    text: str,
    next_: str,
    *,
    rubric: str,
    ideal: str,
    keywords: list[str],
    max_points: int = 30,
    loyalty: int = 10,
    safety: int = 10,
    timer: int | None = 60,
    branches: list[dict] | None = None,
    lang: str = "ru",
    placeholder: str | None = None,
    **extra: Any,
) -> dict:
    node: dict[str, Any] = {
        "type": "input",
        "speaker": speaker,
        "text": text,
        "next": next_,
        "rubric": rubric,
        "ideal": ideal,
        "keywords": keywords,
        "max_points": max_points,
        "effects_scale": {"loyalty": loyalty, "safety": safety},
        "lang": lang,
        **extra,
    }
    if timer:
        node["timer"] = timer
    if branches:
        node["branches"] = branches
    if placeholder:
        node["placeholder"] = placeholder
    return node


def end(outcome: str, title: str, text: str) -> dict:
    return {"type": "end", "outcome": outcome, "title": title, "text": text}


def auto_end(success: tuple[str, str], partial: tuple[str, str], fail: tuple[str, str]) -> dict:
    return {
        "type": "end",
        "outcome": "auto",
        "variants": {
            "success": {"title": success[0], "text": success[1]},
            "partial": {"title": partial[0], "text": partial[1]},
            "fail": {"title": fail[0], "text": fail[1]},
        },
    }


def voice(text: str, lang: str = "ru-RU", src: str | None = None) -> dict:
    """Pre-recorded voice message. ``src`` points to a file in frontend/public/audio;
    without it the client synthesizes speech from ``text``."""
    audio = {"text": text, "lang": lang}
    if src:
        audio["src"] = src
    return audio
