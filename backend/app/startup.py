"""Startup hook: create tables and (optionally) seed demo data.

Run before uvicorn boots to guarantee a usable database.
"""
from __future__ import annotations

import logging
import sys
import time

from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from app.core.config import settings
from app.core.database import Base, engine
from app import models  # noqa: F401  register models

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("startup")


def _wait_for_db(retries: int = 30, delay: float = 1.0) -> None:
    for i in range(retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            log.info("Database is reachable")
            return
        except OperationalError as e:
            log.warning("DB not ready (%s/%s): %s", i + 1, retries, e)
            time.sleep(delay)
    raise SystemExit("Database not reachable after retries")


def _create_schema() -> None:
    inspector = inspect(engine)
    if inspector.has_table("assets"):
        log.info("Schema already present — skipping create_all")
        return
    log.info("Creating tables via SQLAlchemy metadata")
    Base.metadata.create_all(bind=engine)


def main() -> None:
    _wait_for_db()
    _create_schema()
    if settings.SEED_ON_STARTUP:
        from scripts.seed import run_seed

        run_seed()
    log.info("Startup complete")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log.exception("Startup failure: %s", e)
        sys.exit(1)
