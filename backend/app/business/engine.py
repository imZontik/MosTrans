"""Scenario engine: non-linear dialogues with timers and two competency scales.

The engine is pure: it knows nothing about the database or HTTP. A scenario is a
graph (JSON) of nodes:

* ``scene``  — narration / a line of dialogue, the player presses "Далее".
* ``choice`` — the player picks one option, optionally against a timer.
* ``input``  — the player answers in free text; the answer is graded by the ML
  service against a rubric (the grade is passed in from outside).
* ``end``    — the outcome of the scenario (success | partial | fail). With
  ``"outcome": "auto"`` it is derived from the share of optimal decisions and
  the texts are taken from ``variants``.

Branching: each choice leads to its own ``next``, a timer can have its own
``timeout`` branch, and a free-text answer can branch by grade (``branches``).
Any scene / choice / input may also carry conditional ``routes`` checked after
the answer, in order; the first one whose conditions all hold overrides the
usual next node. Conditions look at the scales and at earlier answers::

    "routes": [
      {"if": {"loyalty_below": 40}, "next": "angry"},
      {"if": {"chose": "n3:c", "safety_at_least": 50}, "next": "police"}
    ]

Example::

    {
      "start": "n1",
      "initial": {"loyalty": 60, "safety": 70},
      "characters": {"oleg": {"name": "Олег", "role": "пассажир", "avatar": "🧔"}},
      "nodes": {
        "n1": {"type": "choice", "speaker": "oleg", "text": "...", "timer": 20,
               "choices": [{"id": "a", "text": "...", "next": "end", "points": 20,
                            "effects": {"loyalty": 10}, "quality": "best", "feedback": "..."}],
               "timeout": {"next": "end", "effects": {"loyalty": -15}, "feedback": "..."}},
        "end": {"type": "end", "outcome": "success", "title": "...", "text": "..."}
      }
    }
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

SCALES = ("loyalty", "safety")
NODE_TYPES = ("scene", "choice", "input", "end")
OUTCOMES = ("success", "partial", "fail")
QUALITIES = ("best", "ok", "bad")
AUTO_SUCCESS_SHARE = 0.75
AUTO_PARTIAL_SHARE = 0.4
CRITICAL_NODE = "__critical__"
FAST_ANSWER_SHARE = 0.4
FAST_ANSWER_BONUS = 5
DEFAULT_TIMEOUT_EFFECTS = {"loyalty": -10, "safety": -10}
SCALE_CONDITIONS = ("loyalty_below", "loyalty_at_least", "safety_below", "safety_at_least")
CONDITIONS = SCALE_CONDITIONS + ("chose",)

CRITICAL_END = {
    "type": "end",
    "outcome": "fail",
    "title": "Критический инцидент",
    "text": "Рейтинг безопасности упал до нуля. В реальном рейсе такие решения "
    "приводят к угрозе жизни пассажиров. Разберите ошибки и попробуйте снова.",
}


class ScenarioError(ValueError):
    pass


@dataclass
class RunState:
    node_id: str
    loyalty: int
    safety: int
    score: int = 0
    decisions: list[dict] = field(default_factory=list)
    finished: bool = False
    outcome: str | None = None


@dataclass
class Grade:
    score: float  # 0..10
    feedback: str
    verdict: str = ""
    provider: str = "heuristic"


def _clamp(value: int) -> int:
    return max(0, min(100, value))


def get_node(graph: dict, node_id: str) -> dict:
    if node_id == CRITICAL_NODE:
        return CRITICAL_END
    try:
        return graph["nodes"][node_id]
    except KeyError as exc:
        raise ScenarioError(f"Узел «{node_id}» не найден") from exc


def validate_graph(graph: Any) -> list[str]:
    """Return human-readable problems of a scenario graph (empty list — valid)."""
    errors: list[str] = []
    if not isinstance(graph, dict):
        return ["Сценарий должен быть JSON-объектом"]
    nodes = graph.get("nodes")
    if not isinstance(nodes, dict) or not nodes:
        return ["Нет узлов (nodes)"]
    start = graph.get("start")
    if start not in nodes:
        errors.append(f"Стартовый узел «{start}» не найден")
    characters = graph.get("characters") or {}

    def check_target(src: str, target: Any) -> None:
        if target not in nodes:
            errors.append(f"Узел «{src}» ссылается на несуществующий узел «{target}»")

    has_end = False
    for node_id, node in nodes.items():
        if not isinstance(node, dict):
            errors.append(f"Узел «{node_id}» должен быть объектом")
            continue
        node_type = node.get("type")
        if node_type not in NODE_TYPES:
            errors.append(f"Узел «{node_id}»: неизвестный тип «{node_type}»")
            continue
        speaker = node.get("speaker")
        if speaker and speaker != "narrator" and speaker not in characters:
            errors.append(f"Узел «{node_id}»: персонаж «{speaker}» не описан в characters")
        if node_type != "end" and not node.get("text"):
            errors.append(f"Узел «{node_id}»: пустой текст")
        timer = node.get("timer")
        if timer is not None and (not isinstance(timer, (int, float)) or not 5 <= timer <= 120):
            errors.append(f"Узел «{node_id}»: таймер должен быть от 5 до 120 секунд")
        if node_type == "scene":
            check_target(node_id, node.get("next"))
        elif node_type == "choice":
            choices = node.get("choices") or []
            if len(choices) < 2:
                errors.append(f"Узел «{node_id}»: нужно минимум 2 варианта ответа")
            ids = set()
            for choice in choices:
                cid = choice.get("id")
                if not cid or cid in ids:
                    errors.append(f"Узел «{node_id}»: у вариантов должны быть уникальные id")
                ids.add(cid)
                if not choice.get("text"):
                    errors.append(f"Узел «{node_id}»: пустой текст варианта «{cid}»")
                check_target(node_id, choice.get("next"))
                if choice.get("quality", "ok") not in QUALITIES:
                    errors.append(f"Узел «{node_id}»: quality варианта «{cid}» — best | ok | bad")
            if timer and node.get("timeout"):
                check_target(node_id, node["timeout"].get("next"))
        elif node_type == "input":
            if not node.get("rubric"):
                errors.append(f"Узел «{node_id}»: для свободного ответа нужна рубрика оценивания (rubric)")
            check_target(node_id, node.get("next"))
            for branch in node.get("branches") or []:
                check_target(node_id, branch.get("next"))
                score = branch.get("min_score")
                if isinstance(score, bool) or not isinstance(score, (int, float)) or not 0 <= score <= 10:
                    errors.append(f"Узел «{node_id}»: порог ветки по оценке (min_score) — число от 0 до 10")
        if node_type != "end":
            _check_routes(node_id, node, nodes, errors)
        else:
            has_end = True
            if node.get("outcome") == "auto":
                missing = [o for o in OUTCOMES if o not in (node.get("variants") or {})]
                if missing:
                    errors.append(f"Узел «{node_id}»: для outcome=auto нужны variants: " + ", ".join(missing))
            elif node.get("outcome") not in OUTCOMES:
                errors.append(f"Узел «{node_id}»: outcome должен быть success | partial | fail | auto")
    if not has_end:
        errors.append("В сценарии нет ни одного финала (type=end)")

    if not errors:
        reachable = _reachable(graph)
        unreachable = [n for n in nodes if n not in reachable]
        if unreachable:
            errors.append("Недостижимые узлы: " + ", ".join(sorted(unreachable)))
    return errors


def _check_routes(node_id: str, node: dict, nodes: dict, errors: list[str]) -> None:
    routes = node.get("routes")
    if routes is None:
        return
    if not isinstance(routes, list):
        errors.append(f"Узел «{node_id}»: routes должен быть списком условных переходов")
        return
    for i, route in enumerate(routes, start=1):
        where = f"Узел «{node_id}», условный переход {i}"
        if not isinstance(route, dict):
            errors.append(f"{where}: должен быть объектом")
            continue
        if route.get("next") not in nodes:
            errors.append(f"{where}: ссылается на несуществующий узел «{route.get('next')}»")
        cond = route.get("if")
        if not isinstance(cond, dict) or not cond:
            errors.append(f"{where}: нет условия (if)")
            continue
        for key, value in cond.items():
            if key not in CONDITIONS:
                errors.append(f"{where}: неизвестное условие «{key}»")
            elif key in SCALE_CONDITIONS:
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 <= value <= 100:
                    errors.append(f"{where}: порог «{key}» должен быть числом от 0 до 100")
            else:
                ref_node, _, ref_choice = str(value).partition(":")
                ref = nodes.get(ref_node)
                if not isinstance(ref, dict) or ref.get("type") != "choice":
                    errors.append(f"{where}: условие chose ссылается на «{ref_node}», это не узел выбора")
                elif not any(c.get("id") == ref_choice for c in ref.get("choices") or []):
                    errors.append(f"{where}: в узле «{ref_node}» нет варианта «{ref_choice}»")


def _targets(node: dict) -> list[str]:
    node_type = node.get("type")
    if node_type in ("scene", "input"):
        targets = [node.get("next")] + [b.get("next") for b in node.get("branches") or []]
    elif node_type == "choice":
        targets = [c.get("next") for c in node.get("choices") or []]
        if node.get("timeout"):
            targets.append(node["timeout"].get("next"))
    else:
        targets = []
    if node_type != "end" and isinstance(node.get("routes"), list):
        targets += [r.get("next") for r in node["routes"] if isinstance(r, dict)]
    return [t for t in targets if t]


def endings(graph: dict) -> list[str]:
    """All endings a player can reach: an end node, or each outcome of an ``auto`` end node."""
    keys = []
    for node_id in _reachable(graph):
        node = graph["nodes"][node_id]
        if node.get("type") != "end":
            continue
        if node.get("outcome") == "auto":
            keys += [f"{node_id}:{o}" for o in OUTCOMES]
        else:
            keys.append(node_id)
    return sorted(keys)


def ending_key(graph: dict, node_id: str, outcome: str | None) -> str:
    if node_id == CRITICAL_NODE:
        return CRITICAL_NODE
    return f"{node_id}:{outcome}" if get_node(graph, node_id).get("outcome") == "auto" else node_id


def forks(graph: dict) -> int:
    """How many steps lead to more than one place: the measure of how non-linear a scenario is."""
    return sum(1 for node in graph.get("nodes", {}).values() if isinstance(node, dict) and len(set(_targets(node))) > 1)


def shape(graph: dict) -> dict:
    """Forks and endings of a stored scenario, for the catalog cards."""
    try:
        return {"forks": forks(graph), "endings": len(endings(graph))}
    except (KeyError, TypeError, AttributeError):
        return {"forks": 0, "endings": 0}


def _reachable(graph: dict) -> set[str]:
    seen: set[str] = set()
    stack = [graph["start"]]
    while stack:
        node_id = stack.pop()
        if node_id in seen or node_id not in graph["nodes"]:
            continue
        seen.add(node_id)
        stack.extend(_targets(graph["nodes"][node_id]))
    return seen


def auto_outcome(decisions: list[dict]) -> str:
    rated = [d for d in decisions if d.get("type") in ("choice", "input")]
    if not rated:
        return "partial"
    share = sum(1 for d in rated if d["quality"] == "best") / len(rated)
    if share >= AUTO_SUCCESS_SHARE:
        return "success"
    if share >= AUTO_PARTIAL_SHARE:
        return "partial"
    return "fail"


def end_texts(node: dict, outcome: str | None) -> dict:
    """Title and text of a final node for the actual outcome."""
    if node.get("outcome") == "auto":
        variant = (node.get("variants") or {}).get(outcome or "partial") or {}
        return {"title": variant.get("title"), "text": variant.get("text", "")}
    return {"title": node.get("title"), "text": node.get("text", "")}


def initial_state(graph: dict) -> RunState:
    initial = graph.get("initial") or {}
    return RunState(
        node_id=graph["start"],
        loyalty=_clamp(int(initial.get("loyalty", 60))),
        safety=_clamp(int(initial.get("safety", 70))),
    )


def public_node(graph: dict, node_id: str) -> dict:
    """Node as the player sees it: no correct answers, effects or links."""
    node = get_node(graph, node_id)
    speaker = node.get("speaker") or "narrator"
    character = (graph.get("characters") or {}).get(speaker) or {}
    view: dict[str, Any] = {
        "id": node_id,
        "type": node["type"],
        "speaker": speaker,
        "speaker_name": character.get("name"),
        "speaker_role": character.get("role"),
        "avatar": character.get("avatar"),
        "text": node.get("text", ""),
        "timer": node.get("timer"),
        "audio": node.get("audio"),
        "image": node.get("image"),
        "hint": node.get("hint"),
    }
    if node["type"] == "choice":
        view["choices"] = [{"id": c["id"], "text": c["text"]} for c in node.get("choices", [])]
    if node["type"] == "input":
        view["placeholder"] = node.get("placeholder") or "Ваш ответ…"
    return view


def _timeout_branch(node: dict) -> dict:
    timeout = node.get("timeout")
    if timeout:
        return timeout
    choices = node.get("choices") or []
    worst = next((c for c in choices if c.get("quality") == "bad"), choices[-1] if choices else None)
    return {
        "next": worst.get("next") if worst else node.get("next"),
        "effects": DEFAULT_TIMEOUT_EFFECTS,
        "feedback": "Время вышло. В нештатной ситуации промедление — тоже решение, и обычно худшее.",
    }


def _holds(cond: dict, state: RunState) -> bool:
    for key, value in cond.items():
        if key == "chose":
            ref_node, _, ref_choice = str(value).partition(":")
            if not any(d["node_id"] == ref_node and d.get("choice_id") == ref_choice for d in state.decisions):
                return False
        elif key in SCALE_CONDITIONS:
            scale, _, op = key.partition("_")
            current = state.loyalty if scale == "loyalty" else state.safety
            if (current < value) != (op == "below"):
                return False
        else:
            return False
    return True


def _route(node: dict, state: RunState, default: str) -> str:
    for route in node.get("routes") or []:
        if _holds(route.get("if") or {}, state):
            return route["next"]
    return default


def _input_next(node: dict, score: float) -> str:
    for branch in sorted(node.get("branches") or [], key=lambda b: -b.get("min_score", 0)):
        if score >= branch.get("min_score", 0):
            return branch["next"]
    return node["next"]


def apply_answer(
    graph: dict,
    state: RunState,
    *,
    node_id: str,
    action: str,
    choice_id: str | None = None,
    text: str | None = None,
    grade: Grade | None = None,
    elapsed: float | None = None,
) -> dict:
    """Apply the player's action to the current node and advance the state.

    ``action`` is one of ``continue`` (scene), ``choose`` (choice),
    ``answer`` (input) or ``timeout`` (timer expired on choice/input).
    Returns what happened: feedback, effects, points and quality of the decision.
    """
    if state.finished:
        raise ScenarioError("Сценарий уже завершён")
    if node_id != state.node_id:
        raise ScenarioError("Ответ относится к другому шагу сценария")
    node = get_node(graph, node_id)
    node_type = node["type"]

    effects: dict[str, int] = {}
    points = 0
    quality = "ok"
    feedback = ""
    answer_text = ""
    grade_view: dict | None = None
    fast = False
    timed_out = action == "timeout"
    tags: list[str] = []

    if node_type == "scene":
        if action != "continue":
            raise ScenarioError("На этом шаге можно только продолжить")
        next_id = node["next"]
    elif node_type == "choice":
        if timed_out:
            if not node.get("timer"):
                raise ScenarioError("У этого шага нет таймера")
            branch = _timeout_branch(node)
            effects = dict(branch.get("effects") or DEFAULT_TIMEOUT_EFFECTS)
            points = int(branch.get("points", 0))
            feedback = branch.get("feedback", "")
            quality = "bad"
            answer_text = "⏱ Время вышло"
            next_id = branch["next"]
        elif action == "choose":
            choice = next((c for c in node.get("choices", []) if c["id"] == choice_id), None)
            if choice is None:
                raise ScenarioError("Такого варианта нет")
            effects = dict(choice.get("effects") or {})
            points = int(choice.get("points", 0))
            quality = choice.get("quality", "ok")
            feedback = choice.get("feedback", "")
            answer_text = choice["text"]
            tags = list(choice.get("tags") or [])
            timer = node.get("timer")
            if timer and elapsed is not None and quality == "best" and elapsed <= timer * FAST_ANSWER_SHARE:
                fast = True
                points += FAST_ANSWER_BONUS
            next_id = choice["next"]
        else:
            raise ScenarioError("Выберите один из вариантов")
    elif node_type == "input":
        if timed_out:
            if not node.get("timer"):
                raise ScenarioError("У этого шага нет таймера")
            ratio = 0.0
            feedback = node.get("timeout_feedback") or "Время вышло — ответ не засчитан."
            answer_text = "⏱ Время вышло"
            score = 0.0
        elif action == "answer":
            if not text or not text.strip():
                raise ScenarioError("Введите ответ")
            if grade is None:
                raise ScenarioError("Ответ не оценён")
            score = max(0.0, min(10.0, float(grade.score)))
            ratio = score / 10
            feedback = grade.feedback
            answer_text = text.strip()
            grade_view = {"score": round(score, 1), "verdict": grade.verdict, "provider": grade.provider}
        else:
            raise ScenarioError("Введите ответ")
        points = round(int(node.get("max_points", 30)) * ratio)
        for scale, weight in (node.get("effects_scale") or {"loyalty": 10, "safety": 10}).items():
            effects[scale] = round(weight * (2 * ratio - 1))
        quality = "best" if ratio >= 0.8 else "ok" if ratio >= 0.5 else "bad"
        tags = list(node.get("tags") or [])
        next_id = _input_next(node, score)
    else:
        raise ScenarioError("Сценарий уже завершён")

    effects = {k: int(v) for k, v in effects.items() if k in SCALES and v}
    state.loyalty = _clamp(state.loyalty + effects.get("loyalty", 0))
    state.safety = _clamp(state.safety + effects.get("safety", 0))
    state.score = max(0, state.score + points)

    state.decisions.append(
        {
            "node_id": node_id,
            "type": node_type,
            "speaker": node.get("speaker") or "narrator",
            "prompt": node.get("text", ""),
            "answer": answer_text,
            "choice_id": choice_id,
            "quality": None if node_type == "scene" else quality,
            "points": points,
            "effects": effects,
            "feedback": feedback,
            "elapsed": round(elapsed, 2) if elapsed is not None else None,
            "timer": node.get("timer"),
            "timed_out": timed_out,
            "fast": fast,
            "tags": tags,
            "grade": grade_view,
        }
    )

    next_id = _route(node, state, next_id)
    if state.safety <= 0:
        next_id = CRITICAL_NODE
    state.node_id = next_id
    next_node = get_node(graph, next_id)
    if next_node["type"] == "end":
        state.finished = True
        outcome = next_node.get("outcome", "partial")
        state.outcome = auto_outcome(state.decisions) if outcome == "auto" else outcome

    return {
        "node_id": node_id,
        "quality": quality,
        "points": points,
        "effects": effects,
        "feedback": feedback,
        "timed_out": timed_out,
        "fast": fast,
        "grade": grade_view,
    }
