"""Grading of free-text answers against a rubric (structured output 0..10)."""

from __future__ import annotations

import logging
import re

from app.providers.llm import LLMError, LLMProvider

log = logging.getLogger(__name__)

SYSTEM_RU = (
    "Ты — строгий, но доброжелательный наставник проводников высокоскоростной магистрали (ВСМ). "
    "Оцени ответ сотрудника по рубрике. Отвечай ТОЛЬКО JSON вида "
    '{"score": <число 0-10>, "verdict": "good|partial|bad", "feedback": "<2-3 предложения на русском: что хорошо и чего не хватает>"}. '
    "Оценивай по сути, а не по совпадению слов. Грубость, паника, опасные советы и обещания, которые проводник "
    "не может выполнить, резко снижают балл."
)
SYSTEM_EN_NOTE = " Ответ сотрудника должен быть на английском языке: если он не на английском — ставь не выше 3."

POLITE = ["пожалуйста", "извин", "спасибо", "понимаю", "please", "sorry", "thank", "understand"]
RUDE = ["дура", "идиот", "заткн", "отстань", "твои проблемы", "ваши проблемы", "не моя проблема", "shut up", "stupid"]
PANIC = ["пожар!", "паника", "все умрём", "спасайтесь", "bomb", "бомба"]


def _stem_hits(text: str, keywords: list[str]) -> tuple[list[str], list[str]]:
    lower = text.lower()
    hits = [k for k in keywords if k.lower() in lower]
    return hits, [k for k in keywords if k not in hits]


def _looks_english(text: str) -> bool:
    latin = len(re.findall(r"[a-zA-Z]", text))
    cyrillic = len(re.findall(r"[а-яА-ЯёЁ]", text))
    return latin > cyrillic * 2 and latin > 5


def heuristic_grade(*, answer: str, keywords: list[str], ideal: str, lang: str) -> dict:
    """Deterministic fallback: key points of the rubric, tone and length."""
    text = answer.strip()
    lower = text.lower()
    hits, missing = _stem_hits(text, keywords)
    coverage = len(hits) / len(keywords) if keywords else 0.5
    score = 2.0 + 6.5 * coverage
    words = len(text.split())
    if words < 5:
        score -= 2
    elif 12 <= words <= 90:
        score += 0.5
    if any(p in lower for p in POLITE):
        score += 1
    rude = any(r in lower for r in RUDE)
    if rude:
        score -= 4
    if any(p in lower for p in PANIC):
        score -= 2
    if lang == "en" and not _looks_english(text):
        score = min(score, 3)
    score = round(max(0.0, min(10.0, score)), 1)

    parts = []
    if score >= 8:
        parts.append("Сильный ответ: ключевые пункты регламента на месте, тон профессиональный.")
    elif score >= 5:
        parts.append("Неплохо, но ответ неполный.")
    else:
        parts.append("Ответ не закрывает ситуацию.")
    if rude:
        parts.append("Недопустимый тон — с пассажирами и коллегами только вежливо.")
    if lang == "en" and not _looks_english(text):
        parts.append("Ответ нужно дать на английском языке.")
    if missing and score < 8 and ideal:
        parts.append(f"Пример сильного ответа: «{ideal}»")
    verdict = "good" if score >= 8 else "partial" if score >= 5 else "bad"
    return {"score": score, "verdict": verdict, "feedback": " ".join(parts), "provider": "heuristic"}


async def grade(llm: LLMProvider | None, *, situation: str, rubric: str, ideal: str, keywords: list[str], answer: str, lang: str) -> dict:
    fallback = heuristic_grade(answer=answer, keywords=keywords, ideal=ideal, lang=lang)
    if llm is None:
        return fallback
    system = SYSTEM_RU + (SYSTEM_EN_NOTE if lang == "en" else "")
    user = (
        f"Ситуация: {situation}\n\nРубрика оценивания: {rubric}\n\nЭталонный ответ (для ориентира): {ideal}\n\n"
        f"Ответ сотрудника: «{answer}»"
    )
    try:
        data = await llm.complete_json(system, user)
        score = float(data["score"])
        if not 0 <= score <= 10:
            raise LLMError("score вне диапазона")
        verdict = data.get("verdict") or ("good" if score >= 8 else "partial" if score >= 5 else "bad")
        return {"score": round(score, 1), "verdict": verdict, "feedback": str(data.get("feedback", "")), "provider": llm.name}
    except (LLMError, KeyError, TypeError, ValueError) as exc:
        log.warning("LLM grading failed, using heuristic: %s", exc)
        return fallback
