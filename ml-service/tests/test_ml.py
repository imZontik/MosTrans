import asyncio

from app.assistant import select_data
from app.generation import template_scenario
from app.grading import heuristic_grade
from app.providers.llm import extract_json

KEYWORDS = ["медицин", "врач", "вагон", "подойти", "просим"]


def test_good_answer_scores_high():
    result = heuristic_grade(
        answer="Уважаемые пассажиры! Если среди вас есть медицинский работник или врач, просим срочно подойти в вагон 4, место 23. Спасибо!",
        keywords=KEYWORDS, ideal="", lang="ru",
    )
    assert result["score"] >= 8 and result["verdict"] == "good"


def test_rude_answer_scores_low():
    result = heuristic_grade(answer="Это ваши проблемы, отстань", keywords=KEYWORDS, ideal="Пример", lang="ru")
    assert result["score"] < 3 and "тон" in result["feedback"]


def test_english_required():
    ru = heuristic_grade(answer="Успокойтесь, врач уже идёт, у вас есть EpiPen?", keywords=["epipen", "calm", "doctor"], ideal="", lang="en")
    en = heuristic_grade(answer="Please stay calm, a doctor is coming. Do you have an EpiPen?", keywords=["epipen", "calm", "doctor"], ideal="", lang="en")
    assert ru["score"] <= 3 < en["score"]


def test_extract_json_from_prose():
    assert extract_json('Вот ответ:\n```json\n{"score": 7}\n```') == {"score": 7}


def test_template_scenario_structure():
    draft = template_scenario("Пассажир требует пересадить его в первый класс бесплатно. Он кричит.", "conflict", 2)
    nodes = draft["graph"]["nodes"]
    assert draft["title"].startswith("Пассажир требует")
    assert nodes["n2"]["timer"] == 20 and len(nodes["n2"]["choices"]) == 3
    assert nodes["end"]["outcome"] == "auto"


def test_assistant_safety_intent():
    snapshot = {"employees": [
        {"id": 1, "name": "Анна", "safety_trend": -12.5, "safety_30d": 60, "runs": 5, "position": "Проводник"},
        {"id": 2, "name": "Иван", "safety_trend": 3.0, "safety_30d": 80, "runs": 5, "position": "Проводник"},
    ]}
    intent, answer, table, _ = select_data("Покажи всех проводников, у кого упал рейтинг безопасности за месяц", snapshot)
    assert intent == "safety_drop" and "Анна" in answer
    assert [r["id"] for r in table["rows"]] == [1]


def test_generate_without_llm():
    from app.generation import generate

    result = asyncio.run(generate(None, spec="Пассажир потерял паспорт в поезде и паникует.", category="service", position="conductor", difficulty=1))
    assert result["provider"] == "template"
