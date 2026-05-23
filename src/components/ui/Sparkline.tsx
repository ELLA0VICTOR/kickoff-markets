import { clamp } from '../../lib/format'

type SparklineProps = {
  values: number[]
  className?: string
}

export function Sparkline({ values, className = '' }: SparklineProps) {
  const width = 120
  const height = 36
  const padding = 3
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values
    .map((value, index) => {
      const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2)
      const normalized = (value - min) / range
      const y = height - padding - clamp(normalized, 0, 1) * (height - padding * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      className={`h-9 w-full overflow-visible text-[var(--accent)] ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Market sparkline"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <circle cx={width - padding} cy={points.split(' ').at(-1)?.split(',')[1] ?? height / 2} r="2" fill="currentColor" />
    </svg>
  )
}
