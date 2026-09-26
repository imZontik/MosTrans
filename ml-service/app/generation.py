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
                {"id": "c", "text": "Ошибка", "next": "n3b", "quality": "bad", "points": 0,
                 "effects": {"safety": -20}, "feedback": "Чем опасно"},
            ],
            "timeout": {"next": "n3b", "effects": {"loyalty": -10}, "feedback": "Время вышло"},
        },
        "n3": {"type": "scene", "speaker": "p1", "text": "Реакция на верное действие", "next": "n4"},
        "n3b": {
            "type": "choice",
            "speaker": "p1",
            "text": "Ситуация обостряется из-за ошибки. Шанс исправиться",
            "timer": 15,
            "choices": [
                {"id": "a", "text": "Исправить ошибку по регламенту", "next": "n4", "quality": "best", "points": 15,
                 "effects": {"safety": 15}, "feedback": "Почему это исправляет ситуацию"},
                {"id": "b", "text": "Усугубить", "next": "end_fail", "quality": "bad", "points": 0,
                 "effects": {"loyalty": -20}, "feedback": "К чему это приводит"},
            ],
        },
        "n4": {"type": "input", "speaker": "p1", "text": "Что вы скажете?", "timer": 60, "rubric": "Критерии",
               "ideal": "Эталонный ответ", "keywords": ["корень1", "корень2"], "max_points": 30,
               "effects_scale": {"loyalty": 15, "safety": 5}, "next": "n4b",
               "branches": [{"min_score": 6, "next": "n5"}]},
        "n4b": {"type": "scene", "speaker": "p1", "text": "Реакция на слабый ответ", "next": "n5",
                "routes": [{"if": {"loyalty_below": 35}, "next": "end_fail"}]},
        "n5": {
            "type": "choice",
            "speaker": "narrator",
            "text": "Финальное решение",
            "timer": 25,
            "choices": [
                {"id": "a", "text": "Лучшее завершение", "next": "end", "quality": "best", "points": 20,
                 "effects": {"safety": 10}, "feedback": "..."},
                {"id": "b", "text": "Слабое завершение", "next": "end", "quality": "bad", "points": 0,
                 "effects": {"safety": -10}, "feedback": "..."},
            ],
        },
        "end": {"type": "end", "outcome": "auto", "variants": {
            "success": {"title": "...", "text": "..."},
            "partial": {"title": "...", "text": "..."},
            "fail": {"title": "...", "text": "..."}}},
        "end_fail": {"type": "end", "outcome": "fail", "title": "...", "text": "Последствия ошибочной ветки"},
    },
}

SYSTEM = (
    "Ты — методист по обучению проводников высокоскоростной магистрали (ВСМ, до 400 км/ч, премиальный сервис). "
    "По техническому заданию инструктора составь НЕЛИНЕЙНЫЙ обучающий сценарий-тренажёр на русском языке. "
    "Требования: минимум 3 решения (type=choice) с таймером 10–30 секунд и вариантами разного качества (best/ok/bad); "
    "1 узел свободного ответа (type=input) с рубрикой. "
    "ГЛАВНОЕ — сценарий ветвится: ход событий зависит от ответа проводника. Минимум в двух узлах type=choice варианты ведут "
    "в РАЗНЫЕ узлы: ошибка — в ветку, где ситуация обостряется и есть шанс исправиться, верное действие — к спокойному развитию. "
    "Ветки могут снова сходиться. Нужно минимум 2 разных финала (type=end), например успешный и провальный. "
    "Можно добавить условные переходы routes в любой узел, кроме end: список {\"if\": условие, \"next\": узел}, "
    "проверяются по порядку после ответа. Условия: loyalty_below, loyalty_at_least, safety_below, safety_at_least (число 0–100) "
    "или chose — ранее выбранный вариант в формате \"узел:вариант\". "
    "У input можно задать branches: [{\"min_score\": 0–10, \"next\": узел}] — ветки по оценке ответа. "
    "Действия — реалистичные, по регламенту: проводник не назначает лекарства, не трогает бесхозные предметы, "
    "неисправности передаёт электромеханику, решения об остановке принимает машинист по докладу начальника поезда. "
    "Ответь ТОЛЬКО JSON: {\"title\": str, \"description\": str, \"cover\": эмодзи, \"graph\": <граф>}. "
    "Формат графа (пример): " + json.dumps(FORMAT, ensure_ascii=False) + ". "
    # Without this the model copies the short example almost one-to-one
    "Пример выше показывает ТОЛЬКО формат полей и структуру веток. Придумай свои ветки под задание: "
    "9–14 узлов, из них 3–5 узлов type=choice, 1 узел type=input и 2–3 узла type=end; "
    "каждый next указывает на узел, который есть в nodes, и каждый узел достижим от start."
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
        "calm": "Хорошо, давайте спокойно. Я просто хочу, чтобы меня услышали.",
        "tense": "Да вы вообще понимаете, что тут происходит?! Я этого так не оставлю!",
        "recover": (
            ("Извиниться за резкость, пригласить пассажира отойти в сторону и спокойно выслушать", "Разговор без зрителей снимает накал."),
            ("Продолжить спор — вы же правы", "Спор на публике превращает недоразумение в скандал."),
        ),
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
        "calm": "Спасибо, что вы рядом… Ему вроде бы чуть легче дышать.",
        "tense": "Помогите же ему, ему становится хуже!",
        "recover": (
            ("Вернуться к пострадавшему, проверить дыхание и сознание, доложить начальнику поезда и объявить поиск медика", "Оценка, помощь и доклад — алгоритм, который спасает минуты."),
            ("Продолжать разбираться самому, никому не сообщая", "Без доклада скорая не встретит поезд на станции."),
        ),
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
        "calm": "Поняли, переходим. Спасибо, что всё спокойно объяснили.",
        "tense": "Что происходит? Нам что-то угрожает? Почему никто ничего не говорит?!",
        "recover": (
            ("Остановиться, отвести людей на безопасное расстояние и немедленно доложить начальнику поезда", "Безопасность людей и доклад важнее, чем закончить начатое."),
            ("Продолжить самому, раз уже начали", "Действия без допуска и доклада опасны для всех."),
        ),
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
        "calm": "Принял, иду. Займи пассажиров, чтобы не волновались.",
        "tense": "Стоп! Кто лез в оборудование? Без допуска туда нельзя — можно и себя, и систему угробить!",
        "recover": (
            ("Признать ошибку, больше ничего не трогать и передать механику всё, что заметили", "Честный доклад помогает механику быстрее найти неисправность."),
            ("Сказать, что ничего не трогали", "Скрытая информация мешает ремонту и подрывает доверие в бригаде."),
        ),
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
        "calm": "Что ж, спасибо, что предупредили заранее. Посмотрим, что вы предложите.",
        "tense": "Я рассчитывал на другой уровень сервиса. Где ваш старший?",
        "recover": (
            ("Извиниться, признать неудобство и предложить конкретное решение прямо сейчас", "Признание и конкретика возвращают доверие."),
            ("Повторить, что правила есть правила", "Формальный ответ окончательно портит впечатление."),
        ),
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
        "calm": "Понял, беру. Спасибо, что сразу сообщил!",
        "tense": "Почему мне никто не сказал раньше? Теперь исправлять вдвое дольше.",
        "recover": (
            ("Коротко доложить коллеге: где, что случилось, что уже сделано, что требуется", "Чёткий доклад экономит время всей бригаде."),
            ("Сказать, что это не ваша зона, и уйти", "Задача осталась без исполнителя."),
        ),
        "rubric": "Чёткий доклад коллеге: где, что случилось, что уже сделано, что требуется.",
        "ideal": "Вагон 5, место 12: не работает розетка, искрит. Пассажира пересадил. Нужна проверка электромеханика.",
        "keywords": ["вагон", "мест", "сделан", "нужн", "провер"],
    },
}


def _title_from(spec: str) -> str:
    first = re.split(r"[.!?\n]", spec.strip())[0]
    return (first[:57] + "…") if len(first) > 60 else first or "Новый сценарий"


def template_scenario(spec: str, category: str, difficulty: int) -> dict:
    """Branching draft without an LLM: the first mistake leads to an escalation branch with a chance to recover."""
    t = CATEGORY_TEMPLATES.get(category, CATEGORY_TEMPLATES["conflict"])
    timer = {1: 25, 2: 20, 3: 15}.get(difficulty, 20)
    next_by_quality = {"best": "n3", "ok": "n3", "bad": "n3b"}
    choices = [
        {"id": f"o{i + 1}", "text": text, "next": next_by_quality[q], "quality": q, "points": pts, "effects": eff, "feedback": fb}
        for i, (text, q, pts, eff, fb) in enumerate(t["first"])
    ]
    (fix, fix_feedback), (worse, worse_feedback) = t["recover"]
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
                "timeout": {"next": "n3b", "effects": {"loyalty": -10, "safety": -10}, "feedback": "Промедление ухудшило ситуацию."},
            },
            "n3": {"type": "scene", "speaker": "p1", "text": t["calm"], "next": "n4"},
            "n3b": {
                "type": "choice",
                "speaker": "p1",
                "text": t["tense"],
                "timer": timer,
                "choices": [
                    {"id": "r1", "text": fix, "next": "n4", "quality": "best", "points": 15,
                     "effects": {"loyalty": 10, "safety": 10}, "feedback": fix_feedback},
                    {"id": "r2", "text": worse, "next": "end_fail", "quality": "bad", "points": 0,
                     "effects": {"loyalty": -15, "safety": -10}, "feedback": worse_feedback},
                ],
                "timeout": {"next": "end_fail", "effects": {"loyalty": -10, "safety": -10}, "feedback": "Ситуация вышла из-под контроля."},
            },
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
                "next": "n4b",
                "branches": [{"min_score": 6, "next": "n5"}],
            },
            "n4b": {
                "type": "scene",
                "speaker": "p1",
                "text": "Это всё, что вы можете сказать? Я ожидал большего.",
                "next": "n5",
                "routes": [{"if": {"loyalty_below": 35}, "next": "end_fail"}],
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
            "end_fail": {
                "type": "end",
                "outcome": "fail",
                "title": "Эскалация",
                "text": "Ошибку не удалось исправить, и ситуация вышла из-под контроля. Разберите решения и попробуйте другой путь.",
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


SPEAKER_ROLES = {"conductor": "проводник", "chief": "начальник поезда", "train_chief": "начальник поезда", "mechanic": "электромеханик"}


def _normalize(graph: dict) -> None:
    """Fix what is safe to fix: undeclared speakers and out-of-range timers."""
    characters = graph.get("characters")
    if not isinstance(characters, dict):
        characters = graph["characters"] = {}
    for node in graph["nodes"].values():
        speaker = node.get("speaker")
        if speaker and speaker != "narrator" and speaker not in characters:
            role = SPEAKER_ROLES.get(speaker, "пассажир")
            characters[speaker] = {"name": role.capitalize(), "role": role, "avatar": "🧑"}
        timer = node.get("timer")
        if isinstance(timer, (int, float)):
            node["timer"] = max(5, min(120, timer))
        if "routes" in node:
            routes = [r for r in node["routes"] or [] if _route_ok(r, graph["nodes"])] if isinstance(node["routes"], list) else []
            if routes:
                node["routes"] = routes
            else:
                del node["routes"]


SCALE_CONDITIONS = ("loyalty_below", "loyalty_at_least", "safety_below", "safety_at_least")


def _route_ok(route, nodes: dict) -> bool:
    if not isinstance(route, dict) or route.get("next") not in nodes:
        return False
    cond = route.get("if")
    if not isinstance(cond, dict) or not cond:
        return False
    for key, value in cond.items():
        if key in SCALE_CONDITIONS:
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 100:
                return False
        elif key == "chose":
            ref_node, _, ref_choice = str(value).partition(":")
            ref = nodes.get(ref_node)
            if not isinstance(ref, dict) or not any(c.get("id") == ref_choice for c in ref.get("choices") or []):
                return False
        else:
            return False
    return True


def _targets(node: dict) -> list:
    targets = [node.get("next")] + [b.get("next") for b in node.get("branches") or [] if isinstance(b, dict)]
    targets += [c.get("next") for c in node.get("choices") or [] if isinstance(c, dict)]
    if isinstance(node.get("timeout"), dict):
        targets.append(node["timeout"].get("next"))
    if isinstance(node.get("routes"), list):
        targets += [r.get("next") for r in node["routes"] if isinstance(r, dict)]
    return [t for t in targets if t]


def _reachable(graph: dict) -> set:
    seen: set = set()
    stack = [graph.get("start")]
    while stack:
        node_id = stack.pop()
        if node_id in seen or node_id not in graph["nodes"]:
            continue
        seen.add(node_id)
        stack.extend(_targets(graph["nodes"][node_id]))
    return seen


def _problems(graph) -> list[str]:
    """Structural errors that need a new draft (same rules as the admin validator)."""
    if not isinstance(graph, dict) or not isinstance(graph.get("nodes"), dict) or not graph["nodes"]:
        return ["нет графа с узлами"]
    nodes = graph["nodes"]
    if any(not isinstance(n, dict) for n in nodes.values()):
        return ["каждый узел должен быть объектом"]
    errors = []
    if graph.get("start") not in nodes:
        errors.append(f"стартовый узел «{graph.get('start')}» не найден")

    def target(src: str, dst) -> None:
        if dst not in nodes:
            errors.append(f"узел «{src}» ссылается на несуществующий узел «{dst}»")

    for node_id, node in nodes.items():
        kind = node.get("type")
        if kind in ("scene", "input"):
            target(node_id, node.get("next"))
        elif kind == "choice":
            choices = node.get("choices") or []
            if len(choices) < 2:
                errors.append(f"в узле «{node_id}» меньше двух вариантов")
            for choice in choices:
                target(node_id, choice.get("next"))
            if node.get("timer") and node.get("timeout"):
                target(node_id, node["timeout"].get("next"))
        elif kind == "end":
            if node.get("outcome") == "auto" and not all(o in (node.get("variants") or {}) for o in ("success", "partial", "fail")):
                errors.append(f"у финала «{node_id}» нужны variants success, partial и fail")
        else:
            errors.append(f"у узла «{node_id}» неизвестный тип «{kind}»")
    if not any(n.get("type") == "end" for n in nodes.values()):
        errors.append("нет финала (type=end)")
    if sum(n.get("type") == "choice" for n in nodes.values()) < 2:
        errors.append("слишком мало решений: нужно минимум 3 узла type=choice")
    forks = [
        node_id for node_id, n in nodes.items()
        if n.get("type") == "choice" and len({c.get("next") for c in n.get("choices") or [] if isinstance(c, dict)}) > 1
    ]
    if len(forks) < 2:
        errors.append(
            "сценарий почти линейный: минимум в двух узлах type=choice варианты должны вести в разные узлы "
            "(ошибка — в ветку с обострением, верное действие — к спокойному развитию)"
        )
    if not errors:
        unreachable = sorted(set(nodes) - _reachable(graph))
        if unreachable:
            errors.append("недостижимые узлы: " + ", ".join(unreachable) + " — на каждый узел должна вести хотя бы одна ссылка")
    return errors


async def generate(llm: LLMProvider | None, *, spec: str, category: str, position: str, difficulty: int) -> dict:
    fallback = template_scenario(spec, category, difficulty)
    if llm is None:
        return fallback
    user = (
        f"Техническое задание инструктора:\n{spec}\n\n"
        f"Категория компетенции: {category}. Должность обучаемого: {position}. Сложность 1–3: {difficulty}."
    )
    error: LLMError | None = None
    for _ in range(2):  # long graphs occasionally come out broken — one retry with the errors
        try:
            prompt = user if error is None else f"{user}\n\nПредыдущий вариант отклонён: {error}. Исправь это."
            data = await llm.complete_json(SYSTEM, prompt, temperature=0.6, heavy=True)
            problems = _problems(data.get("graph"))
            if not problems:
                _normalize(data["graph"])  # may drop broken routes, so check once more
                problems = _problems(data["graph"])
            if problems:
                raise LLMError("; ".join(problems[:5]))
            data.setdefault("title", fallback["title"])
            data.setdefault("description", fallback["description"])
            data.setdefault("cover", fallback["cover"])
            data["provider"] = llm.name
            data["note"] = "Черновик сгенерирован ИИ — проверьте формулировки и соответствие регламенту перед публикацией."
            return data
        except LLMError as exc:
            log.warning("LLM generation failed: %s", exc)
            error = exc
    return {**fallback, "note": f"ИИ не смог собрать сценарий ({error}). Показан шаблонный черновик."}
