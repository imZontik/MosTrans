"""Competency points (очки компетенций, ОК) economy.

One currency drives everything: the level, the weekly leaderboard and the
all-time rating. See docs/ECONOMY.md for the reasoning behind the numbers.
"""

from __future__ import annotations

from dataclasses import dataclass

OUTCOME_BONUS_PER_DIFFICULTY = {"success": 20, "partial": 8, "fail": 0}
MODE_MULTIPLIER = {"training": 1.0, "qualification": 1.5, "emergency": 1.2}
# Replays of the same scenario pay less, so the rating reflects breadth, not grinding.
REPEAT_MULTIPLIER = (1.0, 0.5, 0.25)
REPEAT_FLOOR = 0.1

TOURNAMENT_TOP10_BONUS = 100
TOURNAMENT_WINNER_EXTRA = 50
TOURNAMENT_TOP_N = 10

TOURNAMENT_BASE_POINTS = 100
TOURNAMENT_SPEED_POINTS = 50

LEVELS: list[tuple[int, str]] = [
    (0, "Стажёр"),
    (150, "Проводник-новичок"),
    (400, "Уверенный проводник"),
    (800, "Опытный проводник"),
    (1300, "Проводник-наставник"),
    (2000, "Мастер сервиса"),
    (3000, "Эксперт ВСМ"),
    (4500, "Легенда магистрали"),
]


@dataclass
class LevelInfo:
    level: int
    title: str
    points: int
    current_threshold: int
    next_threshold: int | None
    progress: float  # 0..1 towards the next level


def level_for(points: int) -> LevelInfo:
    index = 0
    for i, (threshold, _) in enumerate(LEVELS):
        if points >= threshold:
            index = i
    current, title = LEVELS[index]
    nxt = LEVELS[index + 1][0] if index + 1 < len(LEVELS) else None
    progress = 1.0 if nxt is None else (points - current) / (nxt - current)
    return LevelInfo(index + 1, title, points, current, nxt, round(progress, 3))


def repeat_multiplier(previous_finishes: int) -> float:
    if previous_finishes < len(REPEAT_MULTIPLIER):
        return REPEAT_MULTIPLIER[previous_finishes]
    return REPEAT_FLOOR


def run_reward(
    *,
    decision_points: int,
    loyalty: int,
    safety: int,
    outcome: str,
    difficulty: int,
    mode: str,
    previous_finishes: int,
) -> dict:
    """Competency points for a finished scenario run with a transparent breakdown."""
    scales_bonus = round((loyalty + safety) / 10)  # 0..20
    outcome_bonus = OUTCOME_BONUS_PER_DIFFICULTY.get(outcome, 0) * max(1, difficulty)
    base = decision_points + scales_bonus + outcome_bonus
    mode_mult = MODE_MULTIPLIER.get(mode, 1.0)
    repeat_mult = 1.0 if mode == "emergency" else repeat_multiplier(previous_finishes)
    total = max(0, round(base * mode_mult * repeat_mult))
    return {
        "decision_points": decision_points,
        "scales_bonus": scales_bonus,
        "outcome_bonus": outcome_bonus,
        "mode_multiplier": mode_mult,
        "repeat_multiplier": repeat_mult,
        "total": total,
    }


def tournament_answer_points(correct: bool, elapsed: float, timer: float) -> int:
    if not correct:
        return 0
    share_left = max(0.0, min(1.0, 1 - elapsed / timer))
    return TOURNAMENT_BASE_POINTS + round(TOURNAMENT_SPEED_POINTS * share_left)


def tournament_reward(place: int) -> int:
    if place > TOURNAMENT_TOP_N:
        return 0
    return TOURNAMENT_TOP10_BONUS + (TOURNAMENT_WINNER_EXTRA if place == 1 else 0)
