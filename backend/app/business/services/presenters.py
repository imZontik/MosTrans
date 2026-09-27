"""Shapes of API responses shared by several use cases."""

from app.repositories.models import Scenario, User, UserAchievement
from app.business.catalog import CATEGORIES, position_title
from app.business.economy import level_for
from app.business.engine import shape


def user_brief(user: User) -> dict:
    level = level_for(user.points)
    return {
        "id": user.id,
        "full_name": user.full_name,
        "position": user.position,
        "position_title": position_title(user.position),
        "team": user.team,
        "depot": user.depot,
        "level": level.level,
        "level_title": level.title,
        "points": user.points,
    }


def short_name(full_name: str) -> str:
    """«Иван Смирнов» -> «Иван С.»: the first name and the initial of the last word (the surname)."""
    words = full_name.split()
    if len(words) < 2:
        return full_name.strip()
    return f"{words[0]} {words[-1][0]}."


def public_name(user: User) -> str:
    """The name colleagues see, as the employee chose it in the profile."""
    return user.full_name if user.name_display == "full" else short_name(user.full_name)


def user_public(user: User) -> dict:
    """``user_brief`` for other employees: ratings, tournaments, a colleague's profile."""
    return {**user_brief(user), "full_name": public_name(user)}


def user_full(user: User) -> dict:
    level = level_for(user.points)
    return {
        **user_brief(user),
        "email": user.email,
        "role": user.role,
        "name_display": user.name_display,
        "public_name": public_name(user),
        "level_info": {
            "level": level.level,
            "title": level.title,
            "points": level.points,
            "current_threshold": level.current_threshold,
            "next_threshold": level.next_threshold,
            "progress": level.progress,
        },
        "created_at": user.created_at,
        "last_active_at": user.last_active_at,
    }


def scenario_brief(s: Scenario) -> dict:
    return {
        "id": s.id,
        "slug": s.slug,
        "title": s.title,
        "description": s.description,
        "category": s.category,
        "category_title": CATEGORIES.get(s.category, {}).get("title", s.category),
        "position": s.position,
        "position_title": position_title(s.position),
        "kind": s.kind,
        "difficulty": s.difficulty,
        "cover": s.cover,
        "estimated_minutes": s.estimated_minutes,
        "is_published": s.is_published,
        "tags": list((s.graph or {}).get("tags") or []),
        **shape(s.graph or {}),
    }


def achievement_view(a: UserAchievement) -> dict:
    return {
        "code": a.code,
        "title": a.title,
        "description": a.description,
        "icon": a.icon,
        "rarity": a.rarity,
        "awarded_at": a.awarded_at,
    }
