"""Achievement catalogue and the rules that unlock them."""

from __future__ import annotations

from dataclasses import dataclass, field

from app.business.catalog import CATEGORIES


@dataclass(frozen=True)
class AchievementDef:
    code: str
    title: str
    description: str
    icon: str
    rarity: str = "common"  # common | rare | epic | legendary


CATALOGUE: list[AchievementDef] = [
    AchievementDef("first_run", "Первый рейс", "Завершите свой первый сценарий", "🚄"),
    AchievementDef("peacemaker", "Миротворец", "Успешно урегулируйте конфликт с пассажиром", "🕊️"),
    AchievementDef("medic", "Первая помощь", "Успешно пройдите медицинский сценарий", "🩺"),
    AchievementDef("vova_friend", "Друг Вовы-механика", "Успешно справьтесь с технической неисправностью", "🔧"),
    AchievementDef("safety_max", "Безопасность прежде всего", "Завершите сценарий с рейтингом безопасности 100", "🛡️", "rare"),
    AchievementDef("loyalty_max", "Любимец пассажиров", "Завершите сценарий с лояльностью пассажира 95+", "💙", "rare"),
    AchievementDef("flawless", "Без единой ошибки", "Все решения в сценарии — оптимальные", "💎", "rare"),
    AchievementDef("lightning", "Реакция 400 км/ч", "Примите 10 верных решений быстрее, чем за 40% таймера", "⚡", "rare"),
    AchievementDef("team_player", "Командный игрок", "5 раз верно передайте задачу коллеге нужной должности", "🤝", "rare"),
    AchievementDef("emergency_ready", "Готов ко всему", "Успешно отработайте внезапный специвент", "🚨", "rare"),
    AchievementDef("polyglot", "Полиглот", "Справьтесь со специвентом на английском языке", "🌍", "epic"),
    AchievementDef("qualification", "Курс на повышение", "Успешно пройдите сценарий следующей должности", "🎓", "epic"),
    AchievementDef("all_categories", "Универсал", "Успех в сценариях всех категорий компетенций", "🧭", "epic"),
    AchievementDef("level_5", "Наставник", "Достигните 5 уровня", "🏅", "epic"),
]
BY_CODE = {a.code: a for a in CATALOGUE}

TEAM_PLAYER_TARGET = 5
LIGHTNING_TARGET = 10
CATEGORY_ACHIEVEMENTS = {"conflict": "peacemaker", "medical": "medic", "technical": "vova_friend"}


@dataclass
class FinishedRun:
    outcome: str
    category: str
    mode: str
    kind: str
    loyalty: int
    safety: int
    decisions: list[dict]
    tags: list[str] = field(default_factory=list)


@dataclass
class PlayerStats:
    finished_runs: int
    success_categories: set[str]
    redirect_correct: int
    fast_decisions: int
    level: int


def evaluate(run: FinishedRun, stats: PlayerStats, owned: set[str]) -> list[AchievementDef]:
    """Achievements unlocked by this run (the run is already counted in ``stats``)."""
    success = run.outcome == "success"
    earned: list[str] = []

    def check(code: str, condition: bool) -> None:
        if condition and code not in owned and code not in earned:
            earned.append(code)

    check("first_run", stats.finished_runs >= 1)
    if success and run.category in CATEGORY_ACHIEVEMENTS:
        check(CATEGORY_ACHIEVEMENTS[run.category], True)
    check("safety_max", run.safety >= 100 and run.outcome != "fail")
    check("loyalty_max", run.loyalty >= 95 and run.outcome != "fail")
    rated = [d for d in run.decisions if d["type"] in ("choice", "input")]
    check("flawless", success and len(rated) >= 3 and all(d["quality"] == "best" for d in rated))
    check("lightning", stats.fast_decisions >= LIGHTNING_TARGET)
    check("team_player", stats.redirect_correct >= TEAM_PLAYER_TARGET)
    check("emergency_ready", success and run.mode == "emergency")
    check("polyglot", run.outcome != "fail" and run.mode == "emergency" and "english" in run.tags)
    check("qualification", success and run.mode == "qualification")
    check("all_categories", set(CATEGORIES) <= stats.success_categories)
    check("level_5", stats.level >= 5)
    return [BY_CODE[c] for c in earned]


def week_number(week: str) -> int:
    """'2026-W39' -> 39"""
    return int(week.split("W")[-1])


def tournament_achievements(week: str, place: int) -> list[AchievementDef]:
    n = week_number(week)
    result = []
    if place <= 10:
        result.append(
            AchievementDef(
                f"tournament_top10_{week}",
                f"Топ-10 турнира {n}-й недели",
                f"Вошли в десятку лучших еженедельного турнира ({week}), место: {place}",
                "🏆",
                "epic",
            )
        )
    if place == 1:
        result.append(
            AchievementDef(
                f"tournament_winner_{week}",
                f"Победитель турнира {n}-й недели",
                f"Первое место в еженедельном турнире проводников ({week})",
                "👑",
                "legendary",
            )
        )
    return result
