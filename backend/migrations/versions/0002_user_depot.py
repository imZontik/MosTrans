"""user depot for leaderboards by brigade and depot

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-26 12:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0002'
down_revision: str | None = '0001'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Brigades of the demo data -> their depot (the same mapping as app/seed/demo.py)
DEMO_DEPOTS = {
    'Бригада 1, Москва — Санкт-Петербург': 'Депо Санкт-Петербург',
    'Бригада 2, Москва — Санкт-Петербург': 'Депо Москва',
    'Бригада 3, Москва — Санкт-Петербург': 'Депо Москва',
    'Бригада 4, Москва — Нижний Новгород': 'Депо Нижний Новгород',
}


def upgrade() -> None:
    op.add_column('users', sa.Column('depot', sa.String(length=255), nullable=False, server_default=''))
    users = sa.table('users', sa.column('team', sa.String), sa.column('depot', sa.String))
    for team, depot in DEMO_DEPOTS.items():
        op.execute(users.update().where(users.c.team == team).values(depot=depot))


def downgrade() -> None:
    op.drop_column('users', 'depot')
