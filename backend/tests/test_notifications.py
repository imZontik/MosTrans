from datetime import datetime

from app.business import notifications as msg


def test_promotion_is_important_and_demotion_is_not():
    up = msg.position_changed("conductor", "senior_conductor")
    down = msg.position_changed("train_chief", "conductor")
    assert up.priority == "high" and "Повышение" in up.title and up.link == "/scenarios"
    assert down.priority == "normal" and "Изменена" in down.title


def test_tournament_result_depends_on_place():
    winner = msg.tournament_result(7, "Турнир 39-й недели", 1, 20, 1400, 150)
    top = msg.tournament_result(7, "Турнир 39-й недели", 4, 20, 1100, 100)
    rest = msg.tournament_result(7, "Турнир 39-й недели", 15, 20, 400, 0)
    assert winner.priority == top.priority == "high" and rest.priority == "normal"
    assert "победили" in winner.title and "+100" in top.body and "из 20" in rest.body
    # one result per tournament per person
    assert winner.dedupe == rest.dedupe == "tournament:7:result"


def test_repeatable_events_are_deduplicated_by_key():
    assert msg.level_up(3, "Уверенный проводник").dedupe == "level:3"
    assert msg.achievement("first_run", "Первый рейс", "…", "🚄", "common").dedupe == "achievement:first_run"
    assert msg.weekly_reset("2026-W39", 2, 180).dedupe == "week:2026-W39:reset"
    assert msg.idle("2026-W39", None).dedupe == "week:2026-W39:idle"
    starts = datetime(2026, 9, 25, 18, 0)
    assert msg.tournament_soon(3, "Турнир", starts).dedupe != msg.tournament_live(3, "Турнир", 30).dedupe
    # people can be promoted more than once, so a promotion is never deduplicated
    assert msg.position_changed("conductor", "senior_conductor").dedupe is None


def test_rare_achievements_are_louder():
    assert msg.achievement("x", "X", "", "🏅", "legendary").priority == "normal"
    assert msg.achievement("y", "Y", "", "🏅", "common").priority == "low"


def test_audience_label():
    assert msg.audience_label("all") == "Все сотрудники"
    label = msg.audience_label(
        "segment", positions=["senior_conductor"], depots=["Депо Москва"], teams=["Бригада 2, Москва — Санкт-Петербург"], inactive_days=14
    )
    assert label == "Старший проводник · Депо Москва · Бригада 2 · не тренировались 14+ дн."
    assert msg.audience_label("segment") == "Все сотрудники"
    names = ["Анна", "Иван", "Олег", "Мария", "Пётр"]
    assert msg.audience_label("users", names=names) == "Лично: Анна, Иван, Олег и ещё 2"


def test_only_links_inside_the_app():
    assert msg.is_internal_link("") and msg.is_internal_link("/scenarios")
    assert not msg.is_internal_link("https://evil.example") and not msg.is_internal_link("//evil.example")


def test_emergency_quotes_the_lead():
    m = msg.emergency_dispatched("Пассажир без сознания", "Проверка готовности бригады 3")
    assert m.priority == "high" and "«Проверка готовности бригады 3»" in m.body
