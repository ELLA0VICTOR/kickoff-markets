type ProgressBarProps = {
  value: number
  tone?: 'mint' | 'amber'
  label?: string
}

export function ProgressBar({ value, tone = 'mint', label }: ProgressBarProps) {
  const color = tone === 'amber' ? 'bg-[var(--label)]' : 'bg-[var(--accent)]'

  return (
    <div className="flex items-center gap-2">
      {label ? <span className="w-9 shrink-0 font-mono text-[11px] text-[var(--muted)]">{label}</span> : null}
      <div className="h-1.5 w-full overflow-hidden rounded-[1px] bg-[var(--border-soft)]">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(2, Math.min(value, 100))}%` }} />
      </div>
    </div>
  )
}
