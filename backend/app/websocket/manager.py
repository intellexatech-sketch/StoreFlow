from __future__ import annotations

import asyncio
import json
from typing import Any, Set

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def broadcast(self, event: str, payload: dict[str, Any]) -> None:
        message = json.dumps({"event": event, "payload": payload}, default=str)
        stale: list[WebSocket] = []
        async with self._lock:
            targets = list(self._connections)
        for ws in targets:
            try:
                await ws.send_text(message)
            except Exception:
                stale.append(ws)
        if stale:
            async with self._lock:
                for ws in stale:
                    self._connections.discard(ws)


manager = ConnectionManager()


def broadcast_sync(event: str, payload: dict[str, Any]) -> None:
    """Fire-and-forget broadcast from sync code paths.

    Schedules the coroutine on the running event loop when available.
    """
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.create_task(manager.broadcast(event, payload))
        else:
            loop.run_until_complete(manager.broadcast(event, payload))
    except RuntimeError:
        pass
