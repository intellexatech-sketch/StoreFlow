"""Basic benchmark: measures paginated inventory queries and dashboard build."""
from __future__ import annotations

import logging
import time

from app.core.database import SessionLocal
from app.services import asset_service, dashboard_service

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("bench")


def main() -> None:
    db = SessionLocal()
    try:
        t0 = time.perf_counter()
        items, total = asset_service.list_assets(db, page=1, page_size=25)
        log.info("List inventory page 1 (25 rows): %.1f ms — total=%s", (time.perf_counter() - t0) * 1000, total)

        t0 = time.perf_counter()
        items, total = asset_service.list_assets(db, page=1, page_size=25, search="LAP")
        log.info("Search LAP page 1 (25 rows): %.1f ms — total=%s", (time.perf_counter() - t0) * 1000, total)

        t0 = time.perf_counter()
        dash = dashboard_service.build_dashboard(db)
        log.info("Dashboard build: %.1f ms — total_assets=%s", (time.perf_counter() - t0) * 1000, dash["totals"]["total_assets"])
    finally:
        db.close()


if __name__ == "__main__":
    main()
