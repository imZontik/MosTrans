"""Demo data: scenarios, staff accounts and a realistic history of training.

History is produced by actually playing the scenario graphs through the engine
with simulated employees of different skill, so every number on the dashboards
is consistent with the game rules.
"""

from __future__ import annotations

import logging
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.business import achievements as ach
from app.business import notifications as msg
from app.business.economy import level_for, run_reward, tournament_answer_points, tournament_reward
from app.business.engine import Grade, apply_answer, get_node, initial_state, validate_graph
from app.business.tournament import MSK, iso_week, pick_questions
from app.frameworks.config import get_settings
from app.frameworks.security import hash_password
from app.repositories.models import (
    Broadcast,
    Notification,
    PointsLedger,
    Run,
    Scenario,
    Tournament,
    TournamentEntry,
    User,
    UserAchievement,
)
from app.seed.content.emergencies import EMERGENCY_SCENARIOS
from app.seed.content.scenarios import RETIRED_SLUGS, TRAINING_SCENARIOS
from app.seed.content.tournament_questions import QUESTION_POOL

log = logging.getLogger(__name__)

STAFF = [
    ("admin@m400.ru", "admin123", "Администратор платформы", "admin", "train_chief", "Центр обучения ВСМ"),
    ("lead@m400.ru", "lead123", "Елена Викторовна Морозова", "lead", "train_chief", "Руководитель резерва проводников"),
    ("hr@m400.ru", "hr123", "Дмитрий Андреевич Соколов", "lead", "train_chief", "HR-бизнес-партнёр"),
]
DEMO_EMPLOYEE = ("demo@m400.ru", "demo123", "Максим Орлов", "conductor", "Бригада 3, Москва — Санкт-Петербург", 0.65, 7)

FIRST_NAMES_M = ["Алексей", "Иван", "Никита", "Сергей", "Максим", "Дмитрий", "Егор", "Павел", "Кирилл", "Роман", "Илья", "Владимир"]
FIRST_NAMES_F = ["Анна", "Мария", "Екатерина", "Дарья", "Ольга", "Полина", "Софья", "Алина", "Виктория", "Ксения", "Юлия", "Елизавета"]
LAST_NAMES = ["Иванов", "Смирнов", "Кузнецов", "Попов", "Васильев", "Петров", "Соколов", "Михайлов", "Новиков", "Фёдоров",
              "Морозов", "Волков", "Алексеев", "Лебедев", "Семёнов", "Егоров", "Павлов", "Козлов", "Степанов", "Николаев"]
TEAMS = ["Бригада 1, Москва — Санкт-Петербург", "Бригада 2, Москва — Санкт-Петербург",
         "Бригада 3, Москва — Санкт-Петербург", "Бригада 4, Москва — Нижний Новгород"]
# Brigade -> depot it belongs to (migration 0002 fills the same for existing demo databases)
TEAM_DEPOTS = {
    TEAMS[0]: "Депо Санкт-Петербург",
    TEAMS[1]: "Депо Москва",
    TEAMS[2]: "Депо Москва",
    TEAMS[3]: "Депо Нижний Новгород",
}
FAKE_EMPLOYEES = 34


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def seed(session: AsyncSession) -> None:
    await _seed_scenarios(session)
    has_users = await session.scalar(select(func.count(User.id)))
    if not has_users:
        log.info("Seeding demo data…")
        rng = random.Random(400)
        await _seed_users_and_history(session, rng)
        await _seed_tournaments(session, rng)
        log.info("Demo data ready")
    # Databases seeded before notifications existed get them too, once
    if not await session.scalar(select(func.count(Notification.id))):
        await _seed_notifications(session)
    await session.commit()


def _note(user_id: int, m: msg.Message, at: datetime, read: bool = False, broadcast_id: int | None = None) -> Notification:
    return Notification(
        user_id=user_id, kind=m.kind, priority=m.priority, title=m.title, body=m.body, link=m.link, icon=m.icon,
        dedupe_key=m.dedupe, broadcast_id=broadcast_id, created_at=at, read_at=at if read else None,
    )


async def _seed_notifications(session: AsyncSession) -> None:
    """A welcome for everyone and a lived-in inbox for the demo employee.

    The inbox is ordered by id, so the notes are inserted oldest first, like real ones arrive.
    """
    now = _now()
    users = list(await session.scalars(select(User)))
    notes = [_note(u.id, msg.welcome(), now - timedelta(days=3), read=u.email != DEMO_EMPLOYEE[0]) for u in users]
    demo = next((u for u in users if u.email == DEMO_EMPLOYEE[0]), None)
    lead = next((u for u in users if u.email == "lead@m400.ru"), None)
    if demo is not None:
        level = level_for(demo.points)
        if level.level > 1:
            notes.append(_note(demo.id, msg.level_up(level.level, level.title), now - timedelta(days=2, hours=3), read=True))
        recent = list(
            await session.scalars(
                select(UserAchievement).where(UserAchievement.user_id == demo.id).order_by(UserAchievement.awarded_at.desc()).limit(2)
            )
        )
        for i, a in enumerate(recent):
            m = msg.achievement(a.code, a.title, a.description, a.icon, a.rarity)
            notes.append(_note(demo.id, m, now - timedelta(days=1, hours=i * 5), read=i > 0))
    if lead is not None:
        employees = [u for u in users if u.role == "employee"]
        text = (
            "Коллеги, до пятницы пройдите, пожалуйста, сценарий «Запах гари в тамбуре». На следующей неделе — плановые "
            "учения по эвакуации, разберём типичные ошибки."
        )
        b = Broadcast(
            sender_id=lead.id, title="Учения по эвакуации на следующей неделе", body=text, priority="high", link="/scenarios",
            audience={"mode": "all"}, audience_label=msg.audience_label("all"), recipients=len(employees),
            created_at=now - timedelta(hours=5),
        )
        session.add(b)
        await session.flush()
        m = msg.broadcast(b.title, b.body, b.priority, b.link, lead.full_name)
        for u in employees:
            read = demo is not None and u.id != demo.id and random.Random(u.id).random() < 0.6
            notes.append(_note(u.id, m, b.created_at, read=read, broadcast_id=b.id))
    notes.sort(key=lambda n: n.created_at)
    session.add_all(notes)
    await session.flush()


async def _seed_scenarios(session: AsyncSession) -> None:
    """Insert new seed scenarios and refresh the ones that were not edited by people."""
    for data in TRAINING_SCENARIOS + EMERGENCY_SCENARIOS:
        errors = validate_graph(data["graph"])
        if errors:
            raise RuntimeError(f"Seed scenario {data['slug']} is invalid: {errors}")
        existing = await session.scalar(select(Scenario).where(Scenario.slug == data["slug"]))
        fields = {k: v for k, v in data.items() if k != "slug"}
        fields.setdefault("kind", "training")
        if existing is None:
            session.add(Scenario(slug=data["slug"], is_published=True, **fields))
        elif existing.created_by is None:
            for key, value in fields.items():
                setattr(existing, key, value)
    # scenarios the seed no longer ships leave the catalog (their runs stay in the history)
    retired = await session.scalars(select(Scenario).where(Scenario.slug.in_(RETIRED_SLUGS), Scenario.created_by.is_(None)))
    for scenario in retired:
        scenario.is_published = False
    await session.flush()


def _simulate(graph: dict, skill: float, rng: random.Random):
    """Play a scenario graph like an employee with the given skill (0..1)."""
    state = initial_state(graph)
    while not state.finished:
        node = get_node(graph, state.node_id)
        kind = node["type"]
        timer = node.get("timer")
        elapsed = rng.uniform(2, (timer or 30) * 0.9)
        if kind == "scene":
            apply_answer(graph, state, node_id=state.node_id, action="continue")
            continue
        if timer and rng.random() < 0.08 * (1 - skill):
            apply_answer(graph, state, node_id=state.node_id, action="timeout", elapsed=timer + 1)
            continue
        if kind == "choice":
            roll = rng.random()
            wanted = "best" if roll < skill else "ok" if roll < skill + (1 - skill) * 0.55 else "bad"
            options = [c for c in node["choices"] if c.get("quality") == wanted] or node["choices"]
            if wanted == "best" and rng.random() < skill * 0.6:
                elapsed = rng.uniform(1, (timer or 30) * 0.35)
            apply_answer(graph, state, node_id=state.node_id, action="choose", choice_id=rng.choice(options)["id"], elapsed=elapsed)
        elif kind == "input":
            score = max(0.0, min(10.0, rng.gauss(skill * 10, 1.6)))
            apply_answer(
                graph,
                state,
                node_id=state.node_id,
                action="answer",
                text=node.get("ideal", "…") if score > 7 else "Постараюсь помочь, сейчас разберёмся.",
                grade=Grade(round(score, 1), "Оценка ИИ-наставника (демо-история).", "demo", "demo"),
                elapsed=elapsed,
            )
    return state


def _random_moment(rng: random.Random, days: int) -> datetime:
    # Skewed to recent days, working hours in Moscow
    day = int(days * (rng.random() ** 1.6))
    local = (_now() - timedelta(days=day)).astimezone(MSK).replace(hour=rng.randint(7, 21), minute=rng.randint(0, 59))
    moment = local.astimezone(timezone.utc)
    return min(moment, _now() - timedelta(minutes=rng.randint(5, 90)))


async def _play_history(
    session: AsyncSession,
    rng: random.Random,
    user: User,
    scenarios: list[Scenario],
    skill: float,
    runs_count: int,
) -> None:
    rank = {"conductor": 1, "senior_conductor": 2, "train_chief": 3}
    available = [s for s in scenarios if rank[s.position] <= rank[user.position] + 1]
    moments = sorted(_random_moment(rng, 45) for _ in range(runs_count))
    finishes: dict[int, int] = {}
    owned: set[str] = set()
    finished_runs = 0
    success_categories: set[str] = set()
    redirect = fast = 0
    points = 0
    for finished_at in moments:
        # Early on people play their own position, later they try the next one
        own = [s for s in available if rank[s.position] <= rank[user.position] and s.kind == "training"]
        scenario = rng.choice(own if rng.random() < 0.75 else available)
        if scenario.kind == "emergency":
            mode = "emergency"
        elif rank[scenario.position] > rank[user.position]:
            mode = "qualification"
        else:
            mode = "training"
        run_skill = max(0.05, min(0.97, skill + finished_runs * 0.01 + rng.uniform(-0.12, 0.12)))
        state = _simulate(scenario.graph, run_skill, rng)
        reward = run_reward(
            decision_points=state.score,
            loyalty=state.loyalty,
            safety=state.safety,
            outcome=state.outcome,
            difficulty=scenario.difficulty,
            mode=mode,
            previous_finishes=finishes.get(scenario.id, 0),
        )
        finishes[scenario.id] = finishes.get(scenario.id, 0) + 1
        run = Run(
            user_id=user.id,
            scenario_id=scenario.id,
            mode=mode,
            status="finished",
            outcome=state.outcome,
            current_node=state.node_id,
            loyalty=state.loyalty,
            safety=state.safety,
            score=state.score,
            decisions=state.decisions,
            points_awarded=reward["total"],
            started_at=finished_at - timedelta(minutes=scenario.estimated_minutes + rng.randint(-1, 3)),
            finished_at=finished_at,
            summary={"outcome": state.outcome, "reward": reward, "achievements": [], "debrief": [], "stats": {}},
        )
        session.add(run)
        session.add(PointsLedger(user_id=user.id, amount=reward["total"], reason="run", ref="seed", created_at=finished_at))
        points += reward["total"]

        finished_runs += 1
        if state.outcome == "success":
            success_categories.add(scenario.category)
        for d in state.decisions:
            redirect += "redirect" in (d.get("tags") or []) and d.get("quality") == "best"
            fast += bool(d.get("fast"))
        stats = ach.PlayerStats(finished_runs, set(success_categories), redirect, fast, level_for(points).level)
        finished = ach.FinishedRun(
            outcome=state.outcome,
            category=scenario.category,
            mode=mode,
            kind=scenario.kind,
            loyalty=state.loyalty,
            safety=state.safety,
            decisions=state.decisions,
            tags=list(scenario.graph.get("tags") or []),
        )
        for definition in ach.evaluate(finished, stats, owned):
            owned.add(definition.code)
            session.add(
                UserAchievement(
                    user_id=user.id,
                    code=definition.code,
                    title=definition.title,
                    description=definition.description,
                    icon=definition.icon,
                    rarity=definition.rarity,
                    awarded_at=finished_at,
                )
            )
    user.points += points
    if moments:
        user.last_active_at = moments[-1]


async def _seed_users_and_history(session: AsyncSession, rng: random.Random) -> None:
    for email, password, name, role, position, team in STAFF:
        session.add(User(email=email, password_hash=hash_password(password), full_name=name, role=role, position=position, team=team))

    scenarios = list(await session.scalars(select(Scenario)))
    password_hash = hash_password("demo123")

    email, _, name, position, team, skill, runs = DEMO_EMPLOYEE
    demo = User(email=email, password_hash=password_hash, full_name=name, role="employee", position=position, team=team,
                depot=TEAM_DEPOTS[team],
                created_at=_now() - timedelta(days=30))
    session.add(demo)
    await session.flush()
    await _play_history(session, rng, demo, scenarios, skill, runs)

    used_names: set[str] = {name}
    for i in range(FAKE_EMPLOYEES):
        while True:
            female = rng.random() < 0.6  # most conductors are women
            first = rng.choice(FIRST_NAMES_F if female else FIRST_NAMES_M)
            last = rng.choice(LAST_NAMES) + ("а" if female else "")
            full = f"{first} {last}"
            if full not in used_names:
                used_names.add(full)
                break
        roll = rng.random()
        position = "conductor" if roll < 0.68 else "senior_conductor" if roll < 0.93 else "train_chief"
        skill = rng.betavariate(5, 3)
        team = rng.choice(TEAMS)
        user = User(
            email=f"employee{i + 1}@m400.ru",
            password_hash=password_hash,
            full_name=full,
            role="employee",
            position=position,
            team=team,
            depot=TEAM_DEPOTS[team],
            created_at=_now() - timedelta(days=rng.randint(46, 400)),
        )
        session.add(user)
        await session.flush()
        await _play_history(session, rng, user, scenarios, skill, rng.randint(0, 3) if rng.random() < 0.12 else rng.randint(4, 26))
    await session.flush()


async def _seed_tournaments(session: AsyncSession, rng: random.Random) -> None:
    settings = get_settings()
    employees = list(await session.scalars(select(User).where(User.role == "employee", User.email != DEMO_EMPLOYEE[0])))
    now = _now()

    # Finished tournament of the previous week, already summed up
    prev_start = (now - timedelta(days=7)).astimezone(MSK).replace(hour=settings.tournament_hour, minute=0, second=0, microsecond=0)
    prev_start = prev_start.astimezone(timezone.utc)
    prev = Tournament(
        title=f"Турнир {int(iso_week(prev_start).split('W')[1])}-й недели",
        week=iso_week(prev_start),
        starts_at=prev_start,
        ends_at=prev_start + timedelta(minutes=settings.tournament_duration_min),
        questions=pick_questions(QUESTION_POOL, settings.tournament_questions, "seed-prev"),
        finalized=True,
    )
    session.add(prev)
    await session.flush()
    await _fake_entries(session, rng, prev, rng.sample(employees, k=min(24, len(employees))), finalize=True)

    # Live tournament for the demo (this week's slot)
    live = Tournament(
        title=f"Турнир {int(iso_week(now).split('W')[1])}-й недели",
        week=iso_week(now),
        starts_at=now - timedelta(minutes=10),
        ends_at=now + timedelta(hours=6),
        questions=pick_questions(QUESTION_POOL, settings.tournament_questions, "seed-live"),
    )
    session.add(live)
    await session.flush()
    await _fake_entries(session, rng, live, rng.sample(employees, k=min(14, len(employees))), finalize=False)


async def _fake_entries(session: AsyncSession, rng: random.Random, t: Tournament, players: list[User], finalize: bool) -> None:
    entries = []
    for user in players:
        skill = rng.betavariate(5, 3)
        team = rng.choice(TEAMS)
        answers, score, correct = [], 0, 0
        for index, q in enumerate(t.questions):
            elapsed = rng.uniform(2, q["timer"])
            ok = rng.random() < skill
            points = tournament_answer_points(ok, elapsed, q["timer"])
            option = q["correct"] if ok else (q["correct"] + 1) % len(q["options"])
            answers.append({"index": index, "option": option, "correct": ok, "points": points, "elapsed": round(elapsed, 2)})
            score += points
            correct += ok
        finished_at = t.starts_at + timedelta(minutes=rng.uniform(3, 9))
        entry = TournamentEntry(
            tournament_id=t.id,
            user_id=user.id,
            score=score,
            correct=correct,
            current_index=len(t.questions),
            answers=answers,
            started_at=finished_at - timedelta(minutes=3),
            finished_at=finished_at,
        )
        session.add(entry)
        entries.append((entry, user))
    await session.flush()
    if not finalize:
        return
    entries.sort(key=lambda pair: (-pair[0].score, pair[0].finished_at))
    for place, (entry, user) in enumerate(entries, start=1):
        entry.place = place
        bonus = tournament_reward(place)
        if bonus:
            session.add(PointsLedger(user_id=user.id, amount=bonus, reason="tournament", ref=f"tournament:{t.id}", created_at=t.ends_at))
            user.points += bonus
        for definition in ach.tournament_achievements(t.week, place):
            session.add(
                UserAchievement(
                    user_id=user.id,
                    code=definition.code,
                    title=definition.title,
                    description=definition.description,
                    icon=definition.icon,
                    rarity=definition.rarity,
                    awarded_at=t.ends_at,
                )
            )
