import env from '../config/env.js'

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 }
const active = LEVELS[env.env === 'test' ? 'error' : env.env === 'production' ? 'info' : 'debug'] ?? LEVELS.info

const emit = (level, message, meta) => {
  if (LEVELS[level] > active) return
  const line = { ts: new Date().toISOString(), level, message, ...(meta ?? {}) }
  const text = JSON.stringify(line)
  if (level === 'error') console.error(text)
  else if (level === 'warn') console.warn(text)
  else console.log(text)
}

export const logger = {
  error: (message, meta) => emit('error', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  info: (message, meta) => emit('info', message, meta),
  debug: (message, meta) => emit('debug', message, meta),
}
