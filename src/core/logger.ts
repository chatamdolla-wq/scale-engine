// SCALE Engine - Logger
import pino from 'pino'

function resolveLogLevel(): string {
  if (process.env.SCALE_LOG_LEVEL) return process.env.SCALE_LOG_LEVEL
  if (process.argv.includes('--json')) return 'silent'
  return 'info'
}

export const logger = pino({
  level: resolveLogLevel(),
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l' },
        },
})

export type Logger = typeof logger