"""Notifications: what happened to the employee, told in one line and one sentence.

Pure functions: every builder returns a message dict that the notification
service stores for one or many users. ``dedupe`` makes a message idempotent per
user — the same level, trophy or weekly reminder never arrives twice.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta

from app.business.catalog import position_rank, position_title
from app.business.economy import TOURNAMENT_TOP_N

# Importance tags: the filter chips on the notifications page
PRIORITIES = ("high", "normal", "low")
PRIORITY_TITLES = {"high": "Важное", "normal": "Обычное", "low": "Инфо"}

# Reminders run on these days and hours (Moscow time)
WEEKLY_RESET_WEEKDAY, WEEKLY_RESET_HOUR = 6, 12  # Sunday noon: the weekly rating resets on Monday
IDLE_WEEKDAY, IDLE_HOUR = 2, 11  # Wednesday morning
IDLE_DAYS = 7
TOURNAMENT_SOON = timedelta(hours=1)


@dataclass
class Message:
    kind: str
    title: str
    body: str = ""
    priority: str = "normal"
    link: str = ""
    icon: str = "🔔"
    dedupe: str | None = None
    extra: dict = field(default_factory=dict)


def _clip(text: str, n: int) -> str:
    text = " ".join(text.split())
    return text if len(text) <= n else text[: n - 1] + "…"


def welcome() -> Message:
    return Message(
        kind="system",
        title="Добро пожаловать в «Магистраль 400»",
        body="Здесь появятся новые сценарии, итоги турниров, достижения и сообщения от руководителя. "
        "Важное помечено красным — его стоит прочитать в первую очередь.",
        priority="low",
        icon="🚄",
        dedupe="welcome",
    )


def level_up(level: int, title: str, station: str | None = None) -> Message:
    where = f" Поезд прибыл на станцию «{station}»." if station else ""
    return Message(
        kind="level_up",
        title=f"Новый уровень: {level} — {title}",
        body=f"Вы набрали достаточно очков компетенций для следующего уровня.{where} Так держать!",
        priority="normal",
        link="/profile",
        icon="🚉",
        dedupe=f"level:{level}",
    )


def achievement(code: str, title: str, description: str, icon: str, rarity: str) -> Message:
    return Message(
        kind="achievement",
        title=f"Новое достижение: {title}",
        body=description,
        priority="normal" if rarity in ("epic", "legendary") else "low",
        link="/profile/achievements",
        icon=icon or "🏅",
        dedupe=f"achievement:{code}",
    )


def position_changed(old: str, new: str) -> Message:
    if position_rank(new) > position_rank(old):
        return Message(
            kind="promotion",
            title=f"Повышение: {position_title(new).lower()}",
            body=f"Руководитель перевёл вас на должность «{position_title(new)}». Сценарии новой должности теперь "
            "основные, а задания следующей открыты как повышение квалификации (×1,5 очков).",
            priority="high",
            link="/scenarios",
            icon="⭐",
        )
    return Message(
        kind="promotion",
        title=f"Изменена должность: {position_title(new).lower()}",
        body=f"Ваша должность теперь «{position_title(new)}». Каталог сценариев обновлён.",
        priority="normal",
        link="/scenarios",
        icon="🪪",
    )


def unit_changed(team: str, depot: str) -> Message:
    where = ", ".join(x for x in (team, depot) if x) or "без бригады"
    return Message(
        kind="transfer",
        title="Вас перевели в другую бригаду",
        body=f"Новое место работы: {where}. Рейтинг бригады и депо теперь считается с новыми коллегами.",
        priority="normal",
        link="/leaderboard",
        icon="🔁",
    )


def scenario_published(scenario_id: int, title: str, cover: str, category_title: str, qualification: bool) -> Message:
    tail = " Это задание следующей должности — очки ×1,5." if qualification else ""
    return Message(
        kind="scenario",
        title=f"Новый сценарий: {title}",
        body=f"В расписании появился рейс «{title}» ({category_title.lower()}).{tail}",
        priority="low",
        link="/scenarios",
        icon=cover or "🚄",
        dedupe=f"scenario:{scenario_id}:published",
    )


def emergency_dispatched(title: str, message: str | None) -> Message:
    return Message(
        kind="emergency",
        title=f"Специвент от руководителя: {title}",
        body=(f"«{_clip(message, 200)}» " if message else "")
        + "Экстренная ситуация откроется, как только вы будете в приложении.",
        priority="high",
        icon="🚨",
    )


def tournament_soon(tournament_id: int, title: str, starts_at_msk: datetime) -> Message:
    return Message(
        kind="tournament",
        title=f"Через час: {title}",
        body=f"Старт в {starts_at_msk:%H:%M} по Москве. Все отвечают одновременно, топ-{TOURNAMENT_TOP_N} получают трофей и +100 очков.",
        priority="normal",
        link="/tournament",
        icon="⏰",
        dedupe=f"tournament:{tournament_id}:soon",
    )


def tournament_live(tournament_id: int, title: str, minutes: int) -> Message:
    return Message(
        kind="tournament",
        title=f"{title} начался",
        body=f"У вас {minutes} мин, чтобы ответить на вопросы. Чем быстрее верный ответ, тем больше очков.",
        priority="high",
        link="/tournament",
        icon="🏁",
        dedupe=f"tournament:{tournament_id}:live",
    )


def tournament_result(tournament_id: int, title: str, place: int, participants: int, score: int, bonus: int) -> Message:
    if place == 1:
        head, icon = f"Вы победили в турнире «{title}»!", "🏆"
    elif bonus:
        head, icon = f"Топ-{TOURNAMENT_TOP_N} турнира: {place}-е место", "🥇" if place <= 3 else "🎖️"
    else:
        head, icon = f"Итоги турнира: {place}-е место", "📊"
    reward = f" Бонус +{bonus} очков компетенций и трофей уже в профиле." if bonus else " До топ-10 совсем немного — в следующий раз!"
    return Message(
        kind="tournament",
        title=head,
        body=f"{place}-е место из {participants} с результатом {score} очков.{reward}",
        priority="high" if bonus else "normal",
        link="/tournament",
        icon=icon,
        dedupe=f"tournament:{tournament_id}:result",
    )


def weekly_reset(week: str, place: int, points: int) -> Message:
    return Message(
        kind="reminder",
        title="Недельный рейтинг обнулится в понедельник",
        body=f"Сейчас вы на {place}-м месте с {points} очками за неделю. Успейте пройти ещё сценарий, пока очки недели в зачёте.",
        priority="normal",
        link="/leaderboard",
        icon="⏳",
        dedupe=f"week:{week}:reset",
    )


def idle(week: str, days: int | None) -> Message:
    since = f"уже {days} дн." if days else "ещё ни разу"
    return Message(
        kind="reminder",
        title="Пора размять навыки",
        body=f"Вы не проходили сценарии {since}. Пять минут в тренажёре — и решения в реальном рейсе даются легче.",
        priority="low",
        link="/scenarios",
        icon="🧭",
        dedupe=f"week:{week}:idle",
    )


def broadcast(title: str, body: str, priority: str, link: str, sender: str) -> Message:
    return Message(kind="broadcast", title=title, body=body, priority=priority, link=link, icon="📣", extra={"sender": sender})


def audience_label(
    mode: str,
    *,
    positions: list[str] = (),
    depots: list[str] = (),
    teams: list[str] = (),
    inactive_days: int | None = None,
    names: list[str] = (),
) -> str:
    """How the broadcast history names who got the message."""
    if mode == "users":
        shown = ", ".join(names[:3])
        more = len(names) - 3
        return f"Лично: {shown}" + (f" и ещё {more}" if more > 0 else "")
    if mode == "all":
        return "Все сотрудники"
    parts = []
    if positions:
        parts.append(", ".join(position_title(p) for p in positions))
    if depots:
        parts.append(", ".join(depots))
    if teams:
        parts.append(", ".join(t.split(",")[0] for t in teams))
    if inactive_days:
        parts.append(f"не тренировались {inactive_days}+ дн.")
    return " · ".join(parts) or "Все сотрудники"


def is_internal_link(link: str) -> bool:
    return link == "" or (link.startswith("/") and not link.startswith("//") and len(link) <= 255)
