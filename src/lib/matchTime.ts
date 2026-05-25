const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

export function parseMatchTime(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function toDateTimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
  ].join('')
}

export function localDateTimeToUtcIso(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

export function formatUtcTime(value: string) {
  const parsed = parseMatchTime(value)
  if (!parsed) return value

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(parsed)
}

export function countdownLabel(value: string, now = Date.now()) {
  const parsed = parseMatchTime(value)
  if (!parsed) return 'Schedule pending'

  const diff = parsed - now
  const absolute = Math.abs(diff)
  const days = Math.floor(absolute / DAY)
  const hours = Math.floor((absolute % DAY) / HOUR)
  const minutes = Math.floor((absolute % HOUR) / MINUTE)

  if (diff <= -120 * MINUTE) return 'Awaiting result'
  if (diff <= 0) return 'Live window'
  if (days > 0) return `Starts in ${days}d ${hours}h`
  if (hours > 0) return `Starts in ${hours}h ${minutes}m`
  return `Starts in ${Math.max(1, minutes)}m`
}
