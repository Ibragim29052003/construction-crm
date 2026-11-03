import { readFile } from 'node:fs/promises'
import pg from 'pg'
if (!process.env.DATABASE_TEST_URL)
  throw new Error(
    'Укажите DATABASE_TEST_URL для отдельной тестовой базы PostgreSQL с применёнными миграциями.',
  )
const client = new pg.Client({ connectionString: process.env.DATABASE_TEST_URL })
client.on('notice', (notice) => console.log(notice.message))
try {
  await client.connect()
  await client.query(
    await readFile(new URL('../tests/database/security.sql', import.meta.url), 'utf8'),
  )
  console.log('Проверки базы пройдены; тестовые данные отменены.')
} finally {
  await client.end()
}
