export function formatCurrency(value: number) {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }

  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`
  }

  return `$${value.toLocaleString()}`
}

export function formatNumber(value: number) {
  return value.toLocaleString('en-US')
}

export function formatSigned(value: number) {
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${value.toFixed(1)}%`
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}
