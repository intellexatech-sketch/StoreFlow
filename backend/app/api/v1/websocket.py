from __future__ import annotations

import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from jose import JWTError

from app.core.security import decode_token
from app.websocket.manager import manager

router = APIRouter()


@router.websocket("/inventory")
async def inventory_ws(websocket: WebSocket, token: str | None = None) -> None:
    """Realtime inventory event stream.

    The socket is *optional* — the REST API is the source of truth. Clients
    that cannot maintain a WebSocket (blocked by proxies, unsupported
    browsers, transient network issues) fall back to REST polling.

    - Optional JWT verification via `?token=` query string.
    - Client-sent JSON `{"event": "ping"}` messages are answered with a
      `{"event": "pong"}` so intermediaries don't cull an idle connection.
    - Anything else the client sends is ignored, keeping the API future-proof.
    """
    if token:
        try:
            decode_token(token)
        except JWTError:
            await websocket.close(code=4401)
            return

    await manager.connect(websocket)
    try:
        while True:
            raw = await websocket.receive_text()
            if not raw:
                continue
            try:
                msg = json.loads(raw)
            except (ValueError, TypeError):
                continue
            if isinstance(msg, dict) and msg.get("event") == "ping":
                try:
                    await websocket.send_text(json.dumps({"event": "pong", "ts": msg.get("ts")}))
                except Exception:
                    break
    except WebSocketDisconnect:
        pass
    except Exception:
        # Defensive: never let a socket error take down the endpoint.
        pass
    finally:
        await manager.disconnect(websocket)
