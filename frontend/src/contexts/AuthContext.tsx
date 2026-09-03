import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authApi } from '../api/endpoints'
import { getToken, setToken } from '../api/client'
import { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const bootstrap = useCallback(async () => {
    if (!getToken()) {
      setLoading(false)
      return
    }
    try {
      const me = await authApi.me()
      setUser(me)
    } catch {
      setToken(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    setToken(res.access_token)
    const me = await authApi.me()
    setUser(me)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      /* ignore */
    }
    setToken(null)
    setUser(null)
  }, [])

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function hasRole(user: AuthUser | null, ...roles: string[]): boolean {
  if (!user) return false
  if (user.role === 'ADMIN') return true
  return roles.includes(user.role)
}
