import fs from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { pool, query, close } from '../src/config/db.js'
import { logger } from '../src/lib/logger.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const sqlDir = path.join(here, '..', 'sql')

/**
 * Minimal forward-only migration runner.
 *
 * Each file in sql/ runs once, inside a transaction, and is recorded in
 * schema_migrations with its sha256. Editing an already-applied file is
 * detected and reported rather than silently ignored.
 */
export async function migrate({ silent = false, fresh = false } = {}) {
  if (fresh) {
    // `npm run db:reset` passes --fresh. Drops every object in public (including
    // schema_migrations) so all files re-apply from scratch.
    await query('DROP SCHEMA public CASCADE')
    await query('CREATE SCHEMA public')
    await query('GRANT ALL ON SCHEMA public TO public')
    if (!silent) logger.warn('fresh start: dropped schema public')
  }

  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          serial PRIMARY KEY,
      filename    text NOT NULL UNIQUE,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )`)

  const files = (await fs.readdir(sqlDir)).filter((f) => f.endsWith('.sql')).sort()
  const { rows: applied } = await query('SELECT filename, checksum FROM schema_migrations')
  const byName = new Map(applied.map((row) => [row.filename, row.checksum]))

  let ran = 0
  for (const file of files) {
    const sql = await fs.readFile(path.join(sqlDir, file), 'utf8')
    const checksum = crypto.createHash('sha256').update(sql).digest('hex')
    const previous = byName.get(file)

    if (previous) {
      if (previous !== checksum && !silent) {
        logger.warn({ file }, 'file changed after it was applied - create a new numbered file instead')
      }
      continue
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(sql)
      await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [file, checksum])
      await client.query('COMMIT')
      ran += 1
      if (!silent) logger.info({ file }, 'migration applied')
    } catch (err) {
      await client.query('ROLLBACK')
      throw new Error(`migration ${file} failed: ${err.message}`)
    } finally {
      client.release()
    }
  }

  if (!silent) logger.info({ applied: ran, total: files.length }, 'migrations up to date')
  return ran
}

// True when this file is the process entrypoint (`node scripts/migrate.js`).
const isEntrypoint = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isEntrypoint) {
  const args = process.argv.slice(2)
  migrate({ fresh: args.includes('--fresh') })
    .catch((err) => {
      logger.error({ err: err.message }, 'migration run failed')
      process.exitCode = 1
    })
    .finally(close)
}
