"""Владелец задания: sub пользователя Keycloak; NULL — поставлено гостем.

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-26
"""

# Имя файла ревизии начинается с цифры — так именует Alembic.
# pylint: disable=invalid-name

from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

_UPGRADE = """
ALTER TABLE jobs ADD COLUMN owner_sub text CHECK (owner_sub <> '');
COMMENT ON COLUMN jobs.owner_sub IS
    'sub пользователя Keycloak, поставившего задание; NULL — гость: задание '
    'и его прогоны открыты по ссылке. Чужое задание не отличается от '
    'несуществующего.';
"""

_DOWNGRADE = """
ALTER TABLE jobs DROP COLUMN owner_sub;
"""


def upgrade() -> None:
    """Добавляет владельца заданий."""
    op.execute(_UPGRADE)


def downgrade() -> None:
    """Убирает владельца заданий."""
    op.execute(_DOWNGRADE)
