import { query } from '../config/db.js'
import { recordAudit } from '../middleware/error.js'

/** Typed, validated read/write over the app_settings key-value table. */
export const getSetting = async (key, fallback = null) => {
  const { rows } = await query('SELECT value FROM app_settings WHERE key = $1', [key])
  return rows[0] ? rows[0].value : fallback
}

export const getAllSettings = async () => {
  const { rows } = await query('SELECT key, value, updated_at FROM app_settings ORDER BY key')
  return Object.fromEntries(rows.map((row) => [row.key, row.value]))
}

export const upsertSetting = async (key, value, req) => {
  const { rows } = await query(
    `INSERT INTO app_settings (key, value, updated_by)
     VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()
     RETURNING key, value, updated_at`,
    [key, JSON.stringify(value), req?.user?.id ?? null],
  )
  await recordAudit(null, {
    actor: req?.user,
    action: 'settings.update',
    entityType: 'app_setting',
    entityId: key,
    after: { key, value },
    req,
  })
  return rows[0]
}
