import { createContext, useContext } from 'react'
import type { Profile } from '../../shared/api/types'
export const AuthContext = createContext<Profile | null>(null)
export function useProfile() {
  const profile = useContext(AuthContext)
  if (!profile) throw new Error('AuthProvider is required')
  return profile
}
