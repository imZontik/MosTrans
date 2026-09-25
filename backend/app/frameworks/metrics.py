from prometheus_client import Counter, Gauge, Histogram

RUNS_STARTED = Counter("m400_runs_started_total", "Scenario runs started", ["mode", "category"])
RUNS_FINISHED = Counter("m400_runs_finished_total", "Scenario runs finished", ["mode", "category", "outcome"])
DECISIONS = Counter("m400_decisions_total", "Decisions made in scenarios", ["node_type", "quality", "timed_out"])
DECISION_TIME = Histogram(
    "m400_decision_seconds", "Time to make a timed decision", buckets=(1, 2, 3, 5, 8, 12, 17, 25, 35, 60)
)
POINTS_AWARDED = Counter("m400_points_awarded_total", "Competency points awarded", ["reason"])
ACHIEVEMENTS = Counter("m400_achievements_unlocked_total", "Achievements unlocked", ["code"])
TOURNAMENT_ANSWERS = Counter("m400_tournament_answers_total", "Tournament answers", ["correct"])
EMERGENCIES = Counter("m400_emergencies_total", "Emergency events delivered", ["source"])
ML_CALLS = Counter("m400_ml_calls_total", "Calls to the ML service", ["operation", "status"])
ACTIVE_TOURNAMENT_PLAYERS = Gauge("m400_tournament_players", "Players in the live tournament")
