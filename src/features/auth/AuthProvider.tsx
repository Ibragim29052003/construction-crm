import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { LogOut } from 'lucide-react'
import { supabase } from '../../shared/api/supabase'
import { crmApi, useGetProfileQuery } from '../../shared/api/crm-api'
import { store } from '../../app/store'
import { AuthContext } from './auth-context'
import { ErrorState, Loading } from '../../shared/ui/primitives'
import { Login } from './Login'
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const userId = useRef<string | null>(null)
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextId = nextSession?.user.id ?? null
      if (userId.current !== nextId) {
        store.dispatch(crmApi.util.resetApiState())
        userId.current = nextId
      }
      setSession(nextSession)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  const profile = useGetProfileQuery(session?.user.id ?? '', { skip: !session })
  if (session === undefined) return <Loading label="Проверяем сессию…" />
  if (!session) return <Login />
  if (profile.isLoading || profile.isUninitialized) return <Loading label="Загружаем профиль…" />
  if (!profile.data)
    return (
      <div className="access-state">
        <ErrorState error={profile.error} retry={profile.refetch} />
        <p>Если учётная запись новая, администратору нужно добавить профиль и назначить роль.</p>
        <button
          className="button secondary"
          onClick={() => void supabase.auth.signOut({ scope: 'local' })}
        >
          <LogOut size={16} />
          Вернуться ко входу
        </button>
      </div>
    )
  return <AuthContext value={profile.data}>{children}</AuthContext>
}
