from app.business.services.presenters import public_name, short_name, user_brief, user_public
from app.repositories.models import User


def test_short_name_keeps_first_name_and_surname_initial():
    assert short_name("Иван Смирнов") == "Иван С."
    # with a patronymic the surname is still the last word
    assert short_name("Елена Викторовна Морозова") == "Елена М."
    assert short_name("  Иван   Смирнов ") == "Иван С."
    assert short_name("Администратор") == "Администратор"


def test_colleagues_see_the_name_as_chosen():
    user = User(id=1, full_name="Иван Смирнов", name_display="short", position="conductor", team="", depot="", points=0)
    assert public_name(user) == "Иван С."
    assert user_public(user)["full_name"] == "Иван С."
    # leads keep the full name in their panel
    assert user_brief(user)["full_name"] == "Иван Смирнов"
    user.name_display = "full"
    assert user_public(user)["full_name"] == "Иван Смирнов"
