"""how an employee's name is shown to colleagues; synthetic name for the demo conductor

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-27 14:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = '0004'
down_revision: str | None = '0003'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# The demo conductor carried a real person's name; demo data must be synthetic (152-FZ).
# Same name as DEMO_EMPLOYEE in app/seed/demo.py
DEMO_EMAIL = 'demo@m400.ru'
DEMO_NAME = 'Максим Орлов'


def upgrade() -> None:
    op.add_column('users', sa.Column('name_display', sa.String(length=8), nullable=False, server_default='short'))
    users = sa.table('users', sa.column('email', sa.String), sa.column('full_name', sa.String))
    op.execute(users.update().where(users.c.email == DEMO_EMAIL).values(full_name=DEMO_NAME))


def downgrade() -> None:
    op.drop_column('users', 'name_display')
