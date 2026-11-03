import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'
export function checked({ data, error }) {
  if (error) throw new Error(error.message)
  return data
}
export async function demoClients() {
  if (process.env.DEMO_CREDENTIALS_FILE === undefined)
    throw new Error(
      'Укажите DEMO_CREDENTIALS_FILE: JSON с login, email, password для manager, ivan, maria.',
    )
  const users = JSON.parse(await readFile(process.env.DEMO_CREDENTIALS_FILE, 'utf8'))
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) throw new Error('Не заданы публичные параметры Supabase.')
  const clients = {}
  for (const user of users) {
    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { user: account } = checked(
      await client.auth.signInWithPassword({ email: user.email, password: user.password }),
    )
    clients[user.login] = { client, id: account.id }
  }
  return { ...clients, url, key }
}
