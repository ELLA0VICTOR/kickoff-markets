import type { ReactNode } from 'react'
import { Sparkline } from './Sparkline'

type MetricCardProps = {
  label: string
  value: string
  unit?: string
  sub?: ReactNode
  badge?: ReactNode
  sparkline?: number[]
  tone?: 'mint' | 'amber'
}

export function MetricCard({ label, value, unit, sub, badge, sparkline, tone = 'mint' }: MetricCardProps) {
  return (
    <article className="metric-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="terminal-label">{label}</div>
        {badge}
      </div>
      <div className="font-mono text-[30px] font-semibold leading-none text-[var(--value-bright)] tabular-nums sm:text-[34px]">
        {value}
        {unit ? <span className="ml-1.5 text-base text-[var(--value)]">{unit}</span> : null}
      </div>
      {sparkline ? <Sparkline className={tone === 'amber' ? 'text-[var(--label)]' : ''} values={sparkline} /> : null}
      {sub ? <div className="mt-3 font-mono text-[12px] leading-relaxed text-[var(--muted)]">{sub}</div> : null}
    </article>
  )
}
