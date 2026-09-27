"""notifications and broadcasts

Revision ID: 0003
Revises: 0002
Create Date: 2026-09-27 12:00:00
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0003'
down_revision: str | None = '0002'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'broadcasts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sender_id', sa.Integer(), nullable=True),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('priority', sa.String(length=16), nullable=False),
        sa.Column('link', sa.String(length=255), nullable=False),
        sa.Column('audience', sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql'), nullable=False),
        sa.Column('audience_label', sa.String(length=255), nullable=False),
        sa.Column('recipients', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_broadcasts_created_at'), 'broadcasts', ['created_at'], unique=False)

    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=32), nullable=False),
        sa.Column('priority', sa.String(length=16), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('link', sa.String(length=255), nullable=False),
        sa.Column('icon', sa.String(length=16), nullable=False),
        sa.Column('broadcast_id', sa.Integer(), nullable=True),
        sa.Column('dedupe_key', sa.String(length=128), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['broadcast_id'], ['broadcasts.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'dedupe_key'),
    )
    op.create_index('ix_notifications_user_id_id', 'notifications', ['user_id', 'id'], unique=False)
    op.create_index(op.f('ix_notifications_broadcast_id'), 'notifications', ['broadcast_id'], unique=False)
    op.create_index(op.f('ix_notifications_dedupe_key'), 'notifications', ['dedupe_key'], unique=False)
    # Unread counters on every page load: a partial index over what is still unread
    op.create_index(
        'ix_notifications_unread', 'notifications', ['user_id', 'priority'], unique=False,
        postgresql_where=sa.text('read_at IS NULL'),
    )


def downgrade() -> None:
    op.drop_index('ix_notifications_unread', table_name='notifications')
    op.drop_index(op.f('ix_notifications_dedupe_key'), table_name='notifications')
    op.drop_index(op.f('ix_notifications_broadcast_id'), table_name='notifications')
    op.drop_index('ix_notifications_user_id_id', table_name='notifications')
    op.drop_table('notifications')
    op.drop_index(op.f('ix_broadcasts_created_at'), table_name='broadcasts')
    op.drop_table('broadcasts')
