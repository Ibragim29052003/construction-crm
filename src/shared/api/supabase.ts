import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
export const isConfigured = Boolean(url && key && !url.includes('YOUR_PROJECT'))
// Без настроек показываем экран настройки; запросов на фиктивный адрес не отправляем.
export const supabase = createClient<Database>(
  isConfigured ? url! : 'https://unconfigured.invalid',
  isConfigured ? key! : 'unconfigured',
  {
    auth: {
      persistSession: isConfigured,
      autoRefreshToken: isConfigured,
      detectSessionInUrl: false,
    },
  },
)
