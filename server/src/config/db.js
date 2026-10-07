import pg from 'pg'
import env from './env.js'

const { Pool, types } = pg

// numeric/bigint come back as strings by default; money and counters are much
// easier to reason about (and to serialise) as numbers here.
types.setTypeParser(1700, (value) => (value === null ? null : Number(value)))
types.setTypeParser(20, (value) => (value === null ? null : Number(value)))
types.setTypeParser(1082, (value) => value) // date -> keep ISO string
types.setTypeParser(1114, (value) => value) // timestamp without tz -> string

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: env.dbPoolMax,
  ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: 'nashik-parking-api',
})

pool.on('error', (err) => {
  console.error('[db] idle client error', err.message)
})

export const query = (text, params) => pool.query(text, params)

/** Runs `fn` inside a transaction, rolling back on any throw. */
export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

export async function ping() {
  const { rows } = await pool.query('SELECT 1 AS ok')
  return rows[0].ok === 1
}

export async function close() {
  await pool.end()
}
