"""Draft scenario generation for instructors: spec in, branching graph out.

The draft always goes through human review in the admin panel.
"""

from __future__ import annotations

import json
import logging
import re

from app.providers.llm import LLMError, LLMProvider

log = logging.getLogger(__name__)

FORMAT = {
    "start": "n1",
    "initial": {"loyalty": 60, "safety": 70},
    "characters": {"p1": {"name": "Имя", "role": "пассажир", "avatar": "🧑"}},
    "nodes": {
        "n1": {"type": "scene", "speaker": "narrator", "text": "Завязка ситуации", "next": "n2"},
        "n2": {
            "type": "choice",
            "speaker": "p1",
            "text": "Реплика или вопрос",
            "timer": 20,
            "choices": [
                {"id": "a", "text": "Лучшее действие", "next": "n3", "quality": "best", "points": 20,
                 "effects": {"loyalty": 10, "safety": 5}, "feedback": "Почему это верно"},
                {"id": "b", "text": "Допустимое действие", "next": "n3", "quality": "ok", "points": 8,
                 "effects": {"loyalty": -5}, "feedback": "Чего не хватает"},
                {"id": "c", "text": "Ошибка", "next": "n3", "quality": "bad", "points": 0,
                 "effects": {"safety": -20}, "feedback": "Чем опасно"},
            ],
            "timeout": {"next": "n3", "effects": {"loyalty": -10}, "feedback": "Время вышло"},
        },
        "n3": {"type": "input", "speaker": "p1", "text": "Что вы скажете?", "timer": 60, "rubric": "Критерии",
               "ideal": "Эталонный ответ", "keywords": ["корень1", "корень2"], "max_points": 30,
               "effects_scale": {"loyalty": 15, "safety": 5}, "next": "end"},
        "end": {"type": "end", "outcome": "auto", "variants": {
            "success": {"title": "...", "text": "..."},
            "partial": {"title": "...", "text": "..."},
            "fail": {"title": "...", "text": "..."}}},
    },
}

SYSTEM = (
    "Ты — методист по обучению проводников высокоскоростной магистрали (ВСМ, до 400 км/ч, премиальный сервис). "
    "По техническому заданию инструктора составь НЕЛИНЕЙНЫЙ обучающий сценарий-тренажёр на русском языке. "
    "Требования: 6–10 узлов; минимум 3 решения (type=choice) с таймером 10–30 секунд и вариантами разного качества "
    "(best/ok/bad), причём разные варианты ведут в разные ветки; 1 узел свободного ответа (type=input) с рубрикой; "
    "реалистичные действия по регламенту: проводник не назначает лекарства, не трогает бесхозные предметы, "
    "неисправности передаёт электромеханику, решения об остановке принимает машинист по докладу начальника поезда. "
    "Ответь ТОЛЬКО JSON: {\"title\": str, \"description\": str, \"cover\": эмодзи, \"graph\": <граф>}. "
    "Формат графа (пример): " + json.dumps(FORMAT, ensure_ascii=False)
)

CATEGORY_TEMPLATES = {
    "conflict": {
        "cover": "🗣️",
        "character": {"name": "Пассажир", "role": "участник конфликта", "avatar": "😠"},
        "first": [
            ("Спокойно подойти, представиться и выслушать обе стороны", "best", 20, {"loyalty": 10}, "Выслушать — первый шаг к деэскалации."),
            ("Сразу принять сторону того, кто первым пожаловался", "ok", 5, {"loyalty": -10}, "Без фактов решение выглядит несправедливым."),
            ("Громко потребовать прекратить при всём вагоне", "bad", 0, {"loyalty": -20, "safety": -5}, "Публичная конфронтация раздувает конфликт."),
        ],
        "reaction": "Да вы вообще понимаете, что тут происходит?! Я этого так не оставлю!",
        "rubric": "Спокойный тон; признание эмоций пассажира; конкретное предложение решения; без обвинений и угроз; при угрозе безопасности — доклад начальнику поезда.",
        "ideal": "Понимаю ваше возмущение, давайте спокойно разберёмся. Предлагаю вот что: … Если потребуется, я подключу начальника поезда.",
        "keywords": ["понима", "предлага", "спокойн", "разбер", "начальник"],
    },
    "medical": {
        "cover": "🩺",
        "character": {"name": "Пассажир", "role": "родственник пострадавшего", "avatar": "😰"},
        "first": [
            ("Оценить состояние, обеспечить безопасное положение и сразу доложить начальнику поезда", "best", 25, {"safety": 20}, "Оценка, помощь и доклад — базовый алгоритм."),
            ("Пойти искать врача по вагонам", "ok", 5, {"safety": -10}, "Пострадавший остаётся без присмотра; быстрее — объявление по громкой связи."),
            ("Дать лекарство из аптечки поезда", "bad", -5, {"safety": -25}, "Проводник не назначает лекарства."),
        ],
        "reaction": "Помогите же ему, ему становится хуже!",
        "rubric": "Объявление или доклад: спокойно; просьба к медработникам среди пассажиров; номер вагона и места; кратко.",
        "ideal": "Уважаемые пассажиры! Если среди вас есть медицинский работник, просим срочно подойти в вагон № …, место … Спасибо!",
        "keywords": ["медицин", "вагон", "мест", "просим", "подойти"],
    },
    "safety": {
        "cover": "🛡️",
        "character": {"name": "Пассажир", "role": "очевидец", "avatar": "🧑"},
        "first": [
            ("Не трогать источник опасности, отвести людей на безопасное расстояние и доложить начальнику поезда", "best", 25, {"safety": 20}, "Безопасность людей и доклад — прежде всего."),
            ("Сначала самому детально всё осмотреть", "ok", 5, {"safety": -10}, "Потеряно время на доклад."),
            ("Попытаться устранить угрозу своими силами", "bad", 0, {"safety": -25}, "Действия без допуска и доклада опасны."),
        ],
        "reaction": "Что происходит? Нам что-то угрожает?",
        "rubric": "Спокойно, без паники; понятная инструкция куда перейти; честно, без пугающих слов; помощь детям и пожилым.",
        "ideal": "Уважаемые пассажиры, по техническим причинам просим спокойно перейти в соседний вагон. Помогите, пожалуйста, детям и пожилым.",
        "keywords": ["спокойн", "перейд", "вагон", "помог", "пожалуйста"],
    },
    "technical": {
        "cover": "🔧",
        "character": {"name": "Вова", "role": "поездной электромеханик", "avatar": "👨‍🔧"},
        "first": [
            ("Сообщить поездному электромеханику: вагон, что именно не работает, с какого времени", "best", 20, {"safety": 5, "loyalty": 5}, "Неисправности — зона электромеханика."),
            ("Подождать, может само пройдёт", "ok", 5, {"loyalty": -10}, "Неисправность не устранится сама."),
            ("Открыть щит и попробовать починить самому", "bad", -5, {"safety": -25}, "Работа с электрооборудованием без допуска запрещена."),
        ],
        "reaction": "Принял, иду. Займи пассажиров, чтобы не волновались.",
        "rubric": "Извиниться; объяснить причину и срок; предложить конкретную помощь сейчас; не давать невыполнимых обещаний.",
        "ideal": "Приносим извинения: неисправность уже устраняет механик, это займёт около 15 минут. Могу предложить воду и место в соседнем вагоне.",
        "keywords": ["извин", "механик", "минут", "предлож", "вагон"],
    },
    "service": {
        "cover": "⭐",
        "character": {"name": "Пассажир", "role": "пассажир первого класса", "avatar": "🎩"},
        "first": [
            ("Проактивно проинформировать и предложить конкретную помощь", "best", 20, {"loyalty": 15}, "Премиальный сервис — это проактивность."),
            ("Ответить по регламенту, когда спросят", "ok", 8, {"loyalty": -5}, "Формально верно, но без заботы."),
            ("Сказать, что это не ваша зона ответственности", "bad", 0, {"loyalty": -20}, "Пассажир остаётся один на один с проблемой."),
        ],
        "reaction": "Я рассчитывал на другой уровень сервиса.",
        "rubric": "Извинение; конкретика; предложение альтернатив; вежливость; без пустых обещаний.",
        "ideal": "Приношу извинения за неудобства. Могу предложить … Если хотите, я уточню у начальника поезда и вернусь к вам через 5 минут.",
        "keywords": ["извин", "предлож", "уточн", "минут", "пожалуйста"],
    },
    "teamwork": {
        "cover": "🤝",
        "character": {"name": "Коллега", "role": "член поездной бригады", "avatar": "🧑‍✈️"},
        "first": [
            ("Определить, чья это зона, и передать задачу нужному коллеге с точным описанием", "best", 20, {"safety": 5, "loyalty": 5}, "Проводник — координатор, а не мастер на все руки."),
            ("Решить всё самому, никого не отвлекая", "ok", 5, {"safety": -10}, "Вы можете выйти за рамки своих полномочий."),
            ("Проигнорировать — не моя зона", "bad", 0, {"loyalty": -15}, "Задача осталась без исполнителя."),
        ],
        "reaction": "Понял, беру. Спасибо, что сразу сообщил!",
        "rubric": "Чёткий доклад коллеге: где, что случилось, что уже сделано, что требуется.",
        "ideal": "Вагон 5, место 12: не работает розетка, искрит. Пассажира пересадил. Нужна проверка электромеханика.",
        "keywords": ["вагон", "мест", "сделан", "нужн", "провер"],
    },
}


def _title_from(spec: str) -> str:
    first = re.split(r"[.!?\n]", spec.strip())[0]
    return (first[:57] + "…") if len(first) > 60 else first or "Новый сценарий"


def template_scenario(spec: str, category: str, difficulty: int) -> dict:
    t = CATEGORY_TEMPLATES.get(category, CATEGORY_TEMPLATES["conflict"])
    timer = {1: 25, 2: 20, 3: 15}.get(difficulty, 20)
    choices = [
        {"id": f"o{i + 1}", "text": text, "next": "n3", "quality": q, "points": pts, "effects": eff, "feedback": fb}
        for i, (text, q, pts, eff, fb) in enumerate(t["first"])
    ]
    graph = {
        "start": "n1",
        "initial": {"loyalty": 60, "safety": 70},
        "characters": {"p1": t["character"], "chief": {"name": "Начальник поезда", "role": "начальник поезда", "avatar": "👩‍✈️"}},
        "nodes": {
            "n1": {"type": "scene", "speaker": "narrator", "text": spec.strip()[:600], "next": "n2"},
            "n2": {
                "type": "choice",
                "speaker": "narrator",
                "text": "Ваши первые действия?",
                "timer": timer,
                "choices": choices,
                "timeout": {"next": "n3", "effects": {"loyalty": -10, "safety": -10}, "feedback": "Промедление ухудшило ситуацию."},
            },
            "n3": {"type": "scene", "speaker": "p1", "text": t["reaction"], "next": "n4"},
            "n4": {
                "type": "input",
                "speaker": "narrator",
                "text": "Что вы скажете? Напишите реплику.",
                "timer": 60,
                "rubric": t["rubric"],
                "ideal": t["ideal"],
                "keywords": t["keywords"],
                "max_points": 30,
                "effects_scale": {"loyalty": 15, "safety": 10},
                "next": "n5",
            },
            "n5": {
                "type": "choice",
                "speaker": "narrator",
                "text": "Ситуация стабилизировалась. Как завершите?",
                "timer": timer + 5,
                "choices": [
                    {"id": "f1", "text": "Убедиться, что всё решено, доложить начальнику поезда и зафиксировать случай", "next": "end",
                     "quality": "best", "points": 20, "effects": {"loyalty": 5, "safety": 10}, "feedback": "Доклад и фиксация — обязательная часть работы."},
                    {"id": "f2", "text": "Вернуться к своим делам без доклада", "next": "end", "quality": "bad", "points": 0,
                     "effects": {"safety": -10}, "feedback": "Без доклада руководство не узнает о повторяющихся проблемах."},
                ],
            },
            "end": {
                "type": "end",
                "outcome": "auto",
                "variants": {
                    "success": {"title": "Ситуация под контролем", "text": "Вы действовали по регламенту и сохранили лояльность пассажиров."},
                    "partial": {"title": "Справились частично", "text": "Ситуация разрешилась, но не все решения были оптимальными."},
                    "fail": {"title": "Ситуация вышла из-под контроля", "text": "Изучите разбор ошибок и попробуйте снова."},
                },
            },
        },
    }
    return {
        "title": _title_from(spec),
        "description": spec.strip()[:200],
        "cover": t["cover"],
        "graph": graph,
        "provider": "template",
        "note": "Черновик собран по шаблону категории. Подключите GigaChat или Qwen, чтобы получать уникальные сценарии.",
    }


def _sane(data: dict) -> bool:
    graph = data.get("graph")
    return (
        isinstance(graph, dict)
        and isinstance(graph.get("nodes"), dict)
        and graph.get("start") in graph["nodes"]
        and any(n.get("type") == "end" for n in graph["nodes"].values() if isinstance(n, dict))
    )


async def generate(llm: LLMProvider | None, *, spec: str, category: str, position: str, difficulty: int) -> dict:
    fallback = template_scenario(spec, category, difficulty)
    if llm is None:
        return fallback
    user = (
        f"Техническое задание инструктора:\n{spec}\n\n"
        f"Категория компетенции: {category}. Должность обучаемого: {position}. Сложность 1–3: {difficulty}."
    )
    try:
        data = await llm.complete_json(SYSTEM, user, temperature=0.6)
        if not _sane(data):
            raise LLMError("Модель вернула граф без старта или финала")
        data.setdefault("title", fallback["title"])
        data.setdefault("description", fallback["description"])
        data.setdefault("cover", fallback["cover"])
        data["provider"] = llm.name
        data["note"] = "Черновик сгенерирован ИИ — проверьте формулировки и соответствие регламенту перед публикацией."
        return data
    except LLMError as exc:
        log.warning("LLM generation failed, using template: %s", exc)
        return {**fallback, "note": f"ИИ не смог собрать сценарий ({exc}). Показан шаблонный черновик."}
