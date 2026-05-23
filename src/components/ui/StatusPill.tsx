import type { ReactNode } from 'react'

type StatusPillVariant = 'live' | 'success' | 'neutral' | 'warn' | 'danger'

const variantClass: Record<StatusPillVariant, string> = {
  live: 'border-[var(--accent-dim)] text-[var(--accent)]',
  success: 'border-[var(--accent-dim)] text-[var(--value-bright)]',
  neutral: 'border-[var(--border)] text-[var(--text)]',
  warn: 'border-[var(--warn)] text-[var(--warn)]',
  danger: 'border-[var(--danger)] text-[var(--danger)]',
}

type StatusPillProps = {
  children: ReactNode
  variant?: StatusPillVariant
  dot?: boolean
}

export function StatusPill({ children, variant = 'neutral', dot = false }: StatusPillProps) {
  return (
    <span
      className={[
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[2px] border bg-transparent px-2.5 font-mono text-[11px] font-semibold uppercase leading-none',
        variantClass[variant],
      ].join(' ')}
    >
      {dot ? <span className="pulse-dot" /> : null}
      {children}
    </span>
  )
}
