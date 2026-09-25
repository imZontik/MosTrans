"""Apply database migrations before the API starts: `python -m app.frameworks.migrate`."""

import asyncio
import logging
import pathlib

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

from app.frameworks.config import get_settings

log = logging.getLogger("migrate")
MIGRATION_LOCK = 400_401
INITIAL_REVISION = "0001"
ALEMBIC_INI = pathlib.Path(__file__).resolve().parents[2] / "alembic.ini"


async def migrate() -> None:
    config = Config(str(ALEMBIC_INI))
    engine = create_async_engine(get_settings().database_url)
    async with engine.connect() as conn:
        # One replica migrates at a time
        await conn.execute(text("SELECT pg_advisory_lock(:k)"), {"k": MIGRATION_LOCK})
        await conn.commit()
        try:
            tables = await conn.run_sync(lambda c: set(inspect(c).get_table_names()))
            if "users" in tables and "alembic_version" not in tables:
                log.info("Existing schema without migrations history: stamping %s", INITIAL_REVISION)
                await asyncio.to_thread(command.stamp, config, INITIAL_REVISION)
            await asyncio.to_thread(command.upgrade, config, "head")
        finally:
            await conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": MIGRATION_LOCK})
            await conn.commit()
    await engine.dispose()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    asyncio.run(migrate())
