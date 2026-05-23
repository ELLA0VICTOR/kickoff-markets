import { CheckCircle2, Clock3, Gauge, LockKeyhole } from 'lucide-react'
import type { ReactNode } from 'react'
import type { HookStep, MatchMarket } from '../../data/markets'
import { StatusPill } from '../ui/StatusPill'

type HookTimelineProps = {
  steps: HookStep[]
  market: MatchMarket
}

export function HookTimeline({ steps, market }: HookTimelineProps) {
  return (
    <section className="terminal-panel" id="hook">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="terminal-label mb-2">Match Clock Hook</div>
          <h2 className="m-0 font-mono text-[22px] font-semibold text-[var(--value-bright)]">
            Dynamic fees by match phase
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill variant="success">PoolManager</StatusPill>
          <StatusPill variant="live" dot>
            {market.hookFeeBps} bps active
          </StatusPill>
        </div>
      </div>

      <div className="grid gap-px bg-[var(--border)] lg:grid-cols-4">
        {steps.map((step) => (
          <article className="bg-[var(--bg-darker)] p-4" key={step.marker}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="font-mono text-[13px] font-semibold text-[var(--label)]">{step.marker}</span>
              <StepIcon state={step.state} />
            </div>
            <div className="font-mono text-[16px] font-semibold text-[var(--value-bright)]">{step.title}</div>
            <div className="mt-4 grid grid-cols-2 gap-px bg-[var(--border-soft)]">
              <div className="bg-[var(--panel)] p-2">
                <div className="terminal-label">Fee</div>
                <div className="mt-1 font-mono text-[var(--value)]">{step.fee}</div>
              </div>
              <div className="bg-[var(--panel)] p-2">
                <div className="terminal-label">State</div>
                <div className="mt-1 font-mono text-[var(--value)]">{step.state}</div>
              </div>
            </div>
            <p className="mt-4 min-h-10 font-mono text-[12px] leading-relaxed text-[var(--muted)]">{step.incentive}</p>
          </article>
        ))}
      </div>

      <div className="mt-5 grid gap-px bg-[var(--border)] md:grid-cols-3">
        <HookFact icon={<Gauge size={16} strokeWidth={1.8} />} label="Fee Source" value="beforeSwap dynamic fee" />
        <HookFact icon={<Clock3 size={16} strokeWidth={1.8} />} label="Clock Source" value="signed match phase oracle" />
        <HookFact icon={<LockKeyhole size={16} strokeWidth={1.8} />} label="Settlement" value="receipt gated close lane" />
      </div>
    </section>
  )
}

function StepIcon({ state }: { state: HookStep['state'] }) {
  if (state === 'complete') {
    return <CheckCircle2 className="text-[var(--accent)]" size={18} strokeWidth={1.8} />
  }

  if (state === 'active') {
    return <span className="pulse-dot" />
  }

  return <Clock3 className="text-[var(--muted)]" size={18} strokeWidth={1.8} />
}

function HookFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 bg-[var(--panel)] p-3">
      <span className="text-[var(--label)]">{icon}</span>
      <span>
        <span className="terminal-label block">{label}</span>
        <span className="font-mono text-[13px] text-[var(--value)]">{value}</span>
      </span>
    </div>
  )
}
