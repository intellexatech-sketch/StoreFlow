import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getToken } from '../api/client'

export type RealtimeStatus = 'connecting' | 'open' | 'closed' | 'unsupported' | 'disabled'

interface RealtimeEvent {
  event: string
  payload: any
}

type Listener = (evt: RealtimeEvent) => void

interface RealtimeContextValue {
  status: RealtimeStatus
  /** True when the socket is currently open. Consumers can use this to decide
   * whether to enable REST polling as a fallback. */
  connected: boolean
  /** Timestamp of the last event received (0 if none yet). */
  lastEventAt: number
  /** Subscribe to server-pushed events; returns an unsubscribe fn. */
  subscribe: (fn: Listener) => () => void
}

const RealtimeContext = createContext<RealtimeContextValue>({
  status: 'connecting',
  connected: false,
  lastEventAt: 0,
  subscribe: () => () => undefined,
})

const RECONNECT_MAX = 6           // 2^6 = 64s max backoff
const HEARTBEAT_MS = 25_000       // client → server keepalive
const POLL_INTERVAL_MS = 20_000   // fallback refetch cadence
const STALE_THRESHOLD_MS = 90_000 // if no events for this long while "open", assume dead

// Query keys that reflect live inventory state. We invalidate these both on
// WS events AND on the polling loop when WS is unavailable.
const LIVE_KEYS = ['assets', 'dashboard', 'movements', 'audit'] as const

function buildWsUrl(): string | null {
  if (typeof WebSocket === 'undefined') return null
  const base = (import.meta.env.VITE_WS_BASE_URL as string) || '/api/v1/ws'
  const path = base.startsWith('http')
    ? base.replace(/^http/, 'ws')
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${base}`
  const token = getToken()
  return `${path}/inventory${token ? `?token=${encodeURIComponent(token)}` : ''}`
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [status, setStatus] = useState<RealtimeStatus>('connecting')
  const [lastEventAt, setLastEventAt] = useState(0)

  const wsRef = useRef<WebSocket | null>(null)
  const listenersRef = useRef<Set<Listener>>(new Set())
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const stoppedRef = useRef(false)
  const lastEventAtRef = useRef(0)

  const invalidateLive = useCallback(() => {
    for (const key of LIVE_KEYS) qc.invalidateQueries({ queryKey: [key] })
  }, [qc])

  const clearTimers = () => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
    reconnectTimerRef.current = null
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
    heartbeatTimerRef.current = null
  }

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return
    // Immediate refetch on drop, then continue on interval
    invalidateLive()
    pollTimerRef.current = setInterval(invalidateLive, POLL_INTERVAL_MS)
  }, [invalidateLive])

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const scheduleReconnect = useCallback(() => {
    if (stoppedRef.current) return
    reconnectAttemptRef.current = Math.min(reconnectAttemptRef.current + 1, RECONNECT_MAX)
    const delay = 1000 * 2 ** reconnectAttemptRef.current
    reconnectTimerRef.current = setTimeout(connect, delay)
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const connect = useCallback(() => {
    if (stoppedRef.current) return
    const url = buildWsUrl()
    if (!url) {
      setStatus('unsupported')
      startPolling()
      return
    }

    setStatus('connecting')
    try {
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        reconnectAttemptRef.current = 0
        setStatus('open')
        stopPolling()
        // Start client-side heartbeat so intermediaries don't cull the socket
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current)
        heartbeatTimerRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try {
              ws.send(JSON.stringify({ event: 'ping', ts: Date.now() }))
            } catch {
              /* ignore */
            }
          }
          // If the socket claims OPEN but we haven't seen anything for a long
          // time, force a reconnect (dead peer / silently dropped connection).
          if (
            lastEventAtRef.current &&
            Date.now() - lastEventAtRef.current > STALE_THRESHOLD_MS &&
            ws.readyState !== WebSocket.CLOSED
          ) {
            try { ws.close() } catch { /* ignore */ }
          }
        }, HEARTBEAT_MS)
      }

      ws.onmessage = (msg) => {
        const now = Date.now()
        setLastEventAt(now)
        lastEventAtRef.current = now
        let data: RealtimeEvent | null = null
        try {
          data = JSON.parse(msg.data)
        } catch {
          return
        }
        if (!data || !data.event || data.event === 'pong' || data.event === 'ping') return
        invalidateLive()
        if (data.payload?.asset_id) {
          qc.invalidateQueries({ queryKey: ['asset', data.payload.asset_id] })
        }
        for (const listener of listenersRef.current) {
          try { listener(data) } catch { /* ignore listener errors */ }
        }
      }

      ws.onerror = () => {
        try { ws.close() } catch { /* ignore */ }
      }

      ws.onclose = () => {
        clearTimers()
        wsRef.current = null
        if (stoppedRef.current) return
        setStatus('closed')
        startPolling()
        scheduleReconnect()
      }
    } catch {
      setStatus('closed')
      startPolling()
      scheduleReconnect()
    }
  }, [invalidateLive, qc, scheduleReconnect, startPolling, stopPolling])

  useEffect(() => {
    stoppedRef.current = false
    connect()

    const onOnline = () => {
      // Regained network — force a reconnect attempt right away
      reconnectAttemptRef.current = 0
      if (wsRef.current) {
        try { wsRef.current.close() } catch { /* ignore */ }
      } else {
        connect()
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !wsRef.current) {
        reconnectAttemptRef.current = 0
        connect()
      }
    }
    window.addEventListener('online', onOnline)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stoppedRef.current = true
      window.removeEventListener('online', onOnline)
      document.removeEventListener('visibilitychange', onVisibility)
      clearTimers()
      stopPolling()
      if (wsRef.current) {
        try { wsRef.current.close() } catch { /* ignore */ }
        wsRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const subscribe = useCallback<RealtimeContextValue['subscribe']>((fn) => {
    listenersRef.current.add(fn)
    return () => {
      listenersRef.current.delete(fn)
    }
  }, [])

  const value = useMemo<RealtimeContextValue>(
    () => ({
      status,
      connected: status === 'open',
      lastEventAt,
      subscribe,
    }),
    [status, lastEventAt, subscribe],
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}

export function useRealtime() {
  return useContext(RealtimeContext)
}

/** Subscribe imperatively to realtime events. Handler ref is kept live so the
 * caller doesn't need to memoise. */
export function useRealtimeEvent(handler: (evt: RealtimeEvent) => void) {
  const { subscribe } = useRealtime()
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => subscribe((e) => ref.current(e)), [subscribe])
}

/** Returns a refetchInterval value suitable for TanStack Query so a page can
 * poll when realtime is unavailable and stay quiet when it isn't. */
export function useLivePolling(intervalMs = POLL_INTERVAL_MS): number | false {
  const { connected, status } = useRealtime()
  if (connected) return false
  // While the very first connection attempt is in flight, avoid an immediate
  // poll storm; wait until we've conclusively failed at least once.
  if (status === 'connecting') return false
  return intervalMs
}
