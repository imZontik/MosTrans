from app.business.services.leaderboard import unit_of, within
from app.repositories.models import User


def test_unit_of_scope():
    me = User(team="Бригада 3, Москва — Санкт-Петербург", depot="Депо Санкт-Петербург")
    assert unit_of(me, "team") == "Бригада 3, Москва — Санкт-Петербург"
    assert unit_of(me, "depot") == "Депо Санкт-Петербург"
    assert unit_of(me, "company") == ""


def test_within_keeps_order_so_places_are_local():
    company = [(7, 900), (3, 800), (5, 700), (1, 650), (9, 100)]
    brigade = within(company, {5, 9, 1})
    # 3rd in the company becomes 1st in the brigade
    assert brigade == [(5, 700), (1, 650), (9, 100)]
    assert within(company, set()) == []
