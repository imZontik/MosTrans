"""Instructor assistant: questions about employees in natural language.

Data selection is deterministic (intent → filter over the live snapshot), so the
table is always correct; the LLM only phrases the answer.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from app.providers.llm import LLMError, LLMProvider

log = logging.getLogger(__name__)

SYSTEM = (
    "Ты — ИИ-ассистент руководителя проводников ВСМ. Тебе дают вопрос и уже отобранные данные. "
    "Ответь кратко (2–4 предложения) на русском: главный вывод и рекомендация по обучению. "
    "Не выдумывай цифры — используй только переданные данные. Ответ ТОЛЬКО JSON: {\"answer\": \"...\"}"
)

HELP = (
    "Я умею отвечать на вопросы о команде, например: «У кого упал рейтинг безопасности за месяц?», "
    "«Кто лидирует на этой неделе?», «У кого низкая лояльность пассажиров?», «Кто давно не тренировался?», "
    "«Какие ошибки самые частые?», «Сделай сводку по обучению»."
)

COLUMNS = {
    "name": "Сотрудник",
    "position": "Должность",
    "safety_30d": "Безопасность (30 дн)",
    "safety_trend": "Динамика",
    "avg_loyalty": "Лояльность",
    "points_week": "Очки за неделю",
    "points": "Очки всего",
    "level": "Уровень",
    "runs": "Прохождений",
    "last_active": "Последняя активность",
}


def _table(rows: list[dict], columns: list[str]) -> dict:
    return {
        "columns": [{"key": c, "title": COLUMNS[c]} for c in columns],
        "rows": [{"id": r.get("id"), **{c: r.get(c) for c in columns}} for r in rows],
    }


def _parse_dt(value) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _intent(message: str) -> str:
    m = message.lower()
    if any(w in m for w in ("безопасн", "safety")):
        return "safety_drop"
    if "лояльн" in m:
        return "low_loyalty"
    if any(w in m for w in ("лучш", "топ", "лидер", "лидир", "активн")):
        return "top_week"
    if any(w in m for w in ("неактив", "не заход", "давно", "не трен", "пропал", "отста")):
        return "inactive"
    if any(w in m for w in ("ошиб", "проблем", "слаб")):
        return "mistakes"
    if any(w in m for w in ("отчёт", "отчет", "сводк", "итог", "общ", "статист")):
        return "report"
    return "help"


def select_data(message: str, snapshot: dict) -> tuple[str, str, dict | None, dict]:
    """(intent, fallback answer, table, compact facts for the LLM)."""
    employees = snapshot.get("employees") or []
    overview = snapshot.get("overview") or {}
    intent = _intent(message)
    now = datetime.now(timezone.utc)
    for e in employees:
        last = _parse_dt(e.get("last_active_at"))
        e["last_active"] = last.strftime("%d.%m.%Y") if last else "—"

    if intent == "safety_drop":
        rows = sorted((e for e in employees if (e.get("safety_trend") or 0) < 0), key=lambda e: e["safety_trend"])
        names = ", ".join(f"{e['name']} ({e['safety_trend']:+})" for e in rows[:3])
        answer = (
            f"Рейтинг безопасности за последние 30 дней снизился у {len(rows)} сотрудников. Сильнее всего — {names}. "
            "Рекомендую назначить им сценарии категории «Безопасность» и разобрать ошибки на планёрке."
            if rows
            else "Ни у кого из сотрудников рейтинг безопасности за месяц не снизился. 👍"
        )
        return intent, answer, _table(rows[:20], ["name", "position", "safety_30d", "safety_trend", "runs"]), {"rows": rows[:20]}

    if intent == "low_loyalty":
        rows = sorted((e for e in employees if e.get("avg_loyalty") is not None), key=lambda e: e["avg_loyalty"])[:10]
        answer = (
            f"Самая низкая средняя лояльность пассажиров — у {rows[0]['name']} ({rows[0]['avg_loyalty']}). "
            "Полезны сценарии «Конфликты» и «Премиальный сервис»."
            if rows
            else "Данных о прохождениях пока нет."
        )
        return intent, answer, _table(rows, ["name", "position", "avg_loyalty", "runs"]), {"rows": rows}

    if intent == "top_week":
        rows = sorted(employees, key=lambda e: -(e.get("points_week") or 0))[:10]
        answer = (
            f"Лидер недели — {rows[0]['name']}: {rows[0]['points_week']} очков компетенций. "
            "Отметьте лидеров публично — это усиливает вовлечённость команды."
            if rows and rows[0].get("points_week")
            else "На этой неделе очков пока никто не набрал."
        )
        return intent, answer, _table(rows, ["name", "position", "points_week", "level"]), {"rows": rows}

    if intent == "inactive":
        border = now - timedelta(days=7)
        rows = [e for e in employees if (_parse_dt(e.get("last_active_at")) or datetime.min.replace(tzinfo=timezone.utc)) < border]
        answer = (
            f"{len(rows)} сотрудников не тренировались больше недели. Можно отправить им специвент — "
            "внезапная экстренная ситуация хорошо возвращает в тонус."
            if rows
            else "Все сотрудники тренировались на этой неделе."
        )
        return intent, answer, _table(rows[:30], ["name", "position", "last_active", "runs"]), {"count": len(rows)}

    if intent == "mistakes":
        mistakes = overview.get("top_mistakes") or []
        if mistakes:
            top = mistakes[0]
            answer = (
                f"Чаще всего ошибаются в сценарии «{top['scenario']}»: «{top['prompt'][:90]}…» ({top['count']} раз). "
                f"Типичный неверный ответ: «{top['typical_answer'][:90]}»."
            )
        else:
            answer = "Частых ошибок за последние 30 дней не найдено."
        table = {
            "columns": [{"key": "scenario", "title": "Сценарий"}, {"key": "prompt", "title": "Ситуация"}, {"key": "count", "title": "Ошибок"}],
            "rows": mistakes,
        }
        return intent, answer, table, {"mistakes": mistakes}

    if intent == "report":
        answer = (
            f"За 30 дней: {overview.get('runs_30d', 0)} прохождений, успешных — {round((overview.get('success_rate_30d') or 0) * 100)}%. "
            f"Активны за неделю {overview.get('active_7d', 0)} из {overview.get('employees', 0)} сотрудников. "
            f"Средняя безопасность — {overview.get('avg_safety_30d')}, лояльность — {overview.get('avg_loyalty_30d')}. "
            f"Доля просроченных решений по таймеру — {round((overview.get('timeout_rate_30d') or 0) * 100)}%."
        )
        facts = {k: overview.get(k) for k in ("runs_30d", "success_rate_30d", "active_7d", "employees", "avg_safety_30d", "avg_loyalty_30d", "timeout_rate_30d", "categories")}
        return intent, answer, None, facts

    return intent, HELP, None, {}


async def answer(llm: LLMProvider | None, *, message: str, snapshot: dict) -> dict:
    intent, fallback, table, facts = select_data(message, snapshot)
    result = {"answer": fallback, "table": table, "intent": intent, "provider": "rules"}
    if llm is None or intent == "help":
        return result
    try:
        data = await llm.complete_json(
            SYSTEM,
            f"Вопрос руководителя: {message}\n\nДанные: {json.dumps(facts, ensure_ascii=False, default=str)[:6000]}",
        )
        if data.get("answer"):
            result.update(answer=str(data["answer"]), provider=llm.name)
    except LLMError as exc:
        log.warning("LLM assistant failed, using rules: %s", exc)
    return result
