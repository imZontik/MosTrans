"""Reference data of the domain: positions, competency categories, roles."""

POSITIONS: dict[str, dict] = {
    "conductor": {"rank": 1, "title": "Проводник"},
    "senior_conductor": {"rank": 2, "title": "Старший проводник"},
    "train_chief": {"rank": 3, "title": "Начальник поезда"},
}

CATEGORIES: dict[str, dict] = {
    "conflict": {"title": "Конфликты с пассажирами", "icon": "🗣️"},
    "medical": {"title": "Медицинские инциденты", "icon": "🩺"},
    "safety": {"title": "Безопасность", "icon": "🛡️"},
    "technical": {"title": "Технические неисправности", "icon": "🔧"},
    "service": {"title": "Премиальный сервис", "icon": "⭐"},
    "teamwork": {"title": "Зоны ответственности", "icon": "🤝"},
}

ROLES = ("employee", "lead", "admin")
STAFF_ROLES = ("lead", "admin")


def position_rank(position: str) -> int:
    return POSITIONS.get(position, POSITIONS["conductor"])["rank"]


def position_title(position: str) -> str:
    return POSITIONS.get(position, {"title": position})["title"]


def run_mode_for(user_position: str, scenario_position: str, scenario_kind: str) -> str | None:
    """Which mode a scenario is played in for a user, or None when it is locked.

    Scenarios of the user's own (or lower) position are regular training.
    One position above is "qualification" — повышение квалификации.
    Anything higher is locked.
    """
    if scenario_kind == "emergency":
        return "emergency"
    diff = position_rank(scenario_position) - position_rank(user_position)
    if diff <= 0:
        return "training"
    if diff == 1:
        return "qualification"
    return None
