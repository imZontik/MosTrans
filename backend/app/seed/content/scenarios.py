"""Training scenarios: conductor, senior conductor, train chief.

Built from «Примеры ситуаций взаимодействия поездного персонала с пассажирами» (all 51 situations) and the
СТО РЖД standards on serving passengers of high-speed lines (03.011, 03.013, 03.014).
"""

from app.seed.content.board import BOARD_SCENARIOS
from app.seed.content.cabin import CABIN_SCENARIOS

TRAINING_SCENARIOS = BOARD_SCENARIOS + CABIN_SCENARIOS

# The first set of scenarios, replaced by the ones above. Their runs stay in the history, so they are only
# taken off the catalog, not deleted.
RETIRED_SLUGS = [
    "conflict-seat",
    "medical-chest-pain",
    "technical-heat",
    "teamwork-whose-task",
    "service-premium-delay",
    "safety-unattended-bag",
    "safety-smoke",
    "chief-line-outage",
    "emergency-unconscious",
    "emergency-smoke-detector",
    "emergency-english-allergy",
    "emergency-lost-child",
]
