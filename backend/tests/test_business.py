import random

import pytest

from app.business import achievements as ach
from app.business.adaptation import Candidate, CategoryStat, recommend
from app.business.catalog import run_mode_for
from app.business.economy import level_for, run_reward, tournament_answer_points, tournament_reward
from app.business.engine import (
    CRITICAL_NODE,
    Grade,
    ScenarioError,
    apply_answer,
    ending_key,
    endings,
    forks,
    initial_state,
    public_node,
    validate_graph,
)
from app.seed.content.emergencies import EMERGENCY_SCENARIOS
from app.seed.content.scenarios import TRAINING_SCENARIOS
from app.seed.content.tournament_questions import QUESTION_POOL
from app.seed.demo import _simulate

GRAPH = {
    "start": "q",
    "initial": {"loyalty": 50, "safety": 20},
    "characters": {"p": {"name": "Пассажир", "avatar": "🙂"}},
    "nodes": {
        "q": {
            "type": "choice",
            "speaker": "p",
            "text": "?",
            "timer": 10,
            "choices": [
                {"id": "good", "text": "Хорошо", "next": "i", "quality": "best", "points": 20, "effects": {"loyalty": 10}},
                {"id": "bad", "text": "Плохо", "next": "i", "quality": "bad", "points": 0, "effects": {"safety": -30}},
            ],
            "timeout": {"next": "i", "effects": {"loyalty": -5}, "feedback": "Время!"},
        },
        "i": {"type": "input", "text": "Скажите", "rubric": "r", "next": "end", "max_points": 30,
              "effects_scale": {"loyalty": 10, "safety": 10}},
        "end": {"type": "end", "outcome": "success", "title": "Ура", "text": "…"},
    },
}


@pytest.mark.parametrize("scenario", TRAINING_SCENARIOS + EMERGENCY_SCENARIOS, ids=lambda s: s["slug"])
def test_seed_scenarios_are_valid(scenario):
    assert validate_graph(scenario["graph"]) == []


@pytest.mark.parametrize("scenario", TRAINING_SCENARIOS + EMERGENCY_SCENARIOS, ids=lambda s: s["slug"])
def test_seed_scenarios_finish_for_any_player(scenario):
    for skill in (0.05, 0.5, 0.95):
        state = _simulate(scenario["graph"], skill, random.Random(skill))
        assert state.finished and state.outcome in ("success", "partial", "fail")


@pytest.mark.parametrize("scenario", TRAINING_SCENARIOS + EMERGENCY_SCENARIOS, ids=lambda s: s["slug"])
def test_seed_scenarios_branch(scenario):
    graph = scenario["graph"]
    assert forks(graph) >= 1
    choices = [n for n in graph["nodes"].values() if n["type"] == "choice"]
    assert any(len({c["next"] for c in n["choices"]}) > 1 for n in choices)


ROUTED = {
    "start": "q1",
    "initial": {"loyalty": 50, "safety": 80},
    "nodes": {
        "q1": {
            "type": "choice",
            "text": "?",
            "choices": [
                {"id": "calm", "text": "Спокойно", "next": "s", "quality": "best", "effects": {"loyalty": 20}},
                {"id": "rude", "text": "Грубо", "next": "s", "quality": "bad", "effects": {"loyalty": -20}},
                {"id": "odd", "text": "Странно", "next": "s", "quality": "ok"},
            ],
        },
        "s": {
            "type": "scene",
            "text": "Реакция",
            "next": "end_ok",
            "routes": [
                {"if": {"loyalty_below": 40}, "next": "end_angry"},
                {"if": {"chose": "q1:odd"}, "next": "end_odd"},
            ],
        },
        "end_ok": {"type": "end", "outcome": "success", "title": "Ок", "text": ""},
        "end_angry": {"type": "end", "outcome": "fail", "title": "Жалоба", "text": ""},
        "end_odd": {"type": "end", "outcome": "auto", "variants": {o: {"title": o, "text": ""} for o in ("success", "partial", "fail")}},
    },
}


@pytest.mark.parametrize(("choice_id", "final"), [("calm", "end_ok"), ("rude", "end_angry"), ("odd", "end_odd")])
def test_routes_depend_on_scales_and_earlier_answers(choice_id, final):
    assert validate_graph(ROUTED) == []
    state = initial_state(ROUTED)
    apply_answer(ROUTED, state, node_id="q1", action="choose", choice_id=choice_id)
    apply_answer(ROUTED, state, node_id="s", action="continue")
    assert state.finished and state.node_id == final


def test_endings_count_auto_variants():
    assert endings(ROUTED) == ["end_angry", "end_odd:fail", "end_odd:partial", "end_odd:success", "end_ok"]
    assert ending_key(ROUTED, "end_odd", "partial") == "end_odd:partial"
    assert ending_key(ROUTED, CRITICAL_NODE, "fail") == CRITICAL_NODE
    assert forks(ROUTED) == 1  # only the scene with routes leads to more than one place


def test_validate_catches_broken_routes():
    graph = {**ROUTED, "nodes": {**ROUTED["nodes"], "s": {**ROUTED["nodes"]["s"], "routes": [
        {"if": {"loyalty_below": 140}, "next": "end_ok"},
        {"if": {"chose": "q1:zzz"}, "next": "end_ok"},
        {"if": {"mood": "bad"}, "next": "nowhere"},
        {"next": "end_ok"},
    ]}}}
    errors = " | ".join(validate_graph(graph))
    for part in ("от 0 до 100", "нет варианта «zzz»", "неизвестное условие «mood»", "«nowhere»", "нет условия"):
        assert part in errors


def test_public_node_hides_answers():
    view = public_node(GRAPH, "q")
    assert view["choices"] == [{"id": "good", "text": "Хорошо"}, {"id": "bad", "text": "Плохо"}]
    assert "quality" not in str(view) and "points" not in str(view)
    assert view["speaker_name"] == "Пассажир"


def test_fast_best_choice_gets_bonus_and_effects():
    state = initial_state(GRAPH)
    result = apply_answer(GRAPH, state, node_id="q", action="choose", choice_id="good", elapsed=2)
    assert result["fast"] and result["points"] == 25
    assert state.loyalty == 60 and state.node_id == "i"


def test_timeout_takes_timeout_branch():
    state = initial_state(GRAPH)
    result = apply_answer(GRAPH, state, node_id="q", action="timeout")
    assert result["timed_out"] and result["quality"] == "bad"
    assert state.loyalty == 45


def test_zero_safety_is_critical_failure():
    state = initial_state(GRAPH)
    apply_answer(GRAPH, state, node_id="q", action="choose", choice_id="bad", elapsed=5)
    assert state.node_id == CRITICAL_NODE and state.finished and state.outcome == "fail"


def test_graded_input_scales_points_and_effects():
    state = initial_state(GRAPH)
    apply_answer(GRAPH, state, node_id="q", action="choose", choice_id="good", elapsed=8)
    result = apply_answer(GRAPH, state, node_id="i", action="answer", text="ответ", grade=Grade(10, "отлично"))
    assert result["points"] == 30 and result["effects"] == {"loyalty": 10, "safety": 10}
    assert state.finished and state.outcome == "success"


def test_stale_node_is_rejected():
    state = initial_state(GRAPH)
    with pytest.raises(ScenarioError):
        apply_answer(GRAPH, state, node_id="i", action="answer", text="x", grade=Grade(5, ""))


def test_validate_catches_broken_links():
    broken = {"start": "a", "nodes": {"a": {"type": "scene", "text": "x", "next": "nope"}}}
    errors = validate_graph(broken)
    assert any("nope" in e for e in errors) and any("финала" in e for e in errors)


def test_economy():
    reward = run_reward(decision_points=60, loyalty=80, safety=90, outcome="success", difficulty=2, mode="training", previous_finishes=0)
    assert reward["total"] == 60 + 17 + 40
    replay = run_reward(decision_points=60, loyalty=80, safety=90, outcome="success", difficulty=2, mode="training", previous_finishes=1)
    assert replay["total"] == round(117 * 0.5)
    qualification = run_reward(decision_points=60, loyalty=80, safety=90, outcome="success", difficulty=2, mode="qualification", previous_finishes=0)
    assert qualification["total"] == round(117 * 1.5)
    assert level_for(0).level == 1 and level_for(400).level == 3
    assert tournament_answer_points(False, 1, 15) == 0
    assert tournament_answer_points(True, 0, 15) == 150
    assert tournament_reward(1) == 150 and tournament_reward(10) == 100 and tournament_reward(11) == 0


def test_modes_by_position():
    assert run_mode_for("conductor", "conductor", "training") == "training"
    assert run_mode_for("conductor", "senior_conductor", "training") == "qualification"
    assert run_mode_for("conductor", "train_chief", "training") is None
    assert run_mode_for("train_chief", "conductor", "training") == "training"


def test_achievements():
    run = ach.FinishedRun("success", "medical", "emergency", "emergency", 96, 100,
                          [{"type": "choice", "quality": "best"}] * 3, tags=["english"])
    stats = ach.PlayerStats(1, {"medical"}, 0, 0, 1)
    codes = {a.code for a in ach.evaluate(run, stats, set())}
    assert {"first_run", "medic", "safety_max", "loyalty_max", "flawless", "emergency_ready", "polyglot"} <= codes
    assert ach.evaluate(run, stats, codes) == []
    trophies = ach.tournament_achievements("2026-W39", 1)
    assert [t.title for t in trophies] == ["Топ-10 турнира 39-й недели", "Победитель турнира 39-й недели"]


def test_recommendation_targets_weakest_category():
    stats = {"conflict": CategoryStat("conflict", 5, 5, 0.9), "medical": CategoryStat("medical", 3, 0, 0.2)}
    candidates = [Candidate(1, "conflict", 1, 3, "success"), Candidate(2, "medical", 2, 1, "fail"), Candidate(3, "service", 2, 0, None)]
    picked, reason = recommend(stats, candidates)
    assert picked.scenario_id == 3 and "Премиальный сервис" in reason


def test_question_pool_is_consistent():
    assert len({q["id"] for q in QUESTION_POOL}) == len(QUESTION_POOL)
    for q in QUESTION_POOL:
        assert 0 <= q["correct"] < len(q["options"])
