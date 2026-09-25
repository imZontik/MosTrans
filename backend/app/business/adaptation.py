"""Adaptive difficulty: pick the next scenario by the player's weak spots."""

from __future__ import annotations

from dataclasses import dataclass

from app.business.catalog import CATEGORIES


@dataclass
class CategoryStat:
    category: str
    runs: int
    successes: int
    avg_quality: float  # share of optimal decisions, 0..1

    @property
    def mastery(self) -> float:
        """0..1 — how confidently the player handles this category."""
        if self.runs == 0:
            return 0.0
        success_rate = self.successes / self.runs
        confidence = min(1.0, self.runs / 3)
        return round((0.6 * success_rate + 0.4 * self.avg_quality) * confidence, 3)


@dataclass
class Candidate:
    scenario_id: int
    category: str
    difficulty: int
    finishes: int
    best_outcome: str | None


def recommend(stats: dict[str, CategoryStat], candidates: list[Candidate]) -> tuple[Candidate, str] | None:
    """Choose the scenario that trains the weakest competency.

    Unplayed scenarios of the weakest category go first; among played ones the
    worst result is repeated. Difficulty follows mastery: weak players get
    easier scenarios first.
    """
    if not candidates:
        return None
    mastery = {c: (stats[c].mastery if c in stats else 0.0) for c in CATEGORIES}
    outcome_rank = {None: 0, "fail": 1, "partial": 2, "success": 3}

    def key(c: Candidate) -> tuple:
        m = mastery.get(c.category, 0.0)
        target_difficulty = 1 + round(m * 2)
        return (m, outcome_rank[c.best_outcome], c.finishes, abs(c.difficulty - target_difficulty))

    best = min(candidates, key=key)
    category_title = CATEGORIES.get(best.category, {}).get("title", best.category)
    m = mastery.get(best.category, 0.0)
    if best.finishes == 0 and m == 0:
        reason = f"Вы ещё не тренировали направление «{category_title}» — начните с него."
    elif best.best_outcome in (None, "fail", "partial"):
        reason = f"В направлении «{category_title}» есть ошибки — закрепим навык ({round(m * 100)}% освоено)."
    else:
        reason = f"«{category_title}» — ваше самое слабое направление ({round(m * 100)}% освоено)."
    return best, reason
