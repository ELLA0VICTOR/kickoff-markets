import { Clock3, ExternalLink, ShieldCheck, Trophy } from 'lucide-react'
import type { MatchMarket } from '../../data/markets'
import { formatCurrency } from '../../lib/format'
import { ProgressBar } from '../ui/ProgressBar'
import { StatusPill } from '../ui/StatusPill'

type MatchRoomProps = {
  market: MatchMarket
}

export function MatchRoom({ market }: MatchRoomProps) {
  return (
    <section className="terminal-panel">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="terminal-label mb-3">Selected Match Room</div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="team-code-large">{market.sides[0].code}</span>
            <div>
              <h1 className="m-0 font-mono text-[26px] font-semibold leading-tight text-[var(--value-bright)] md:text-[34px]">
                {market.sides[0].name} / {market.sides[1].name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[13px] text-[var(--muted)]">
                <span>{market.stage}</span>
                <span>{market.pool}</span>
                <span>{market.kickoff}</span>
              </div>
            </div>
            <span className="team-code-large">{market.sides[1].code}</span>
          </div>
        </div>

        <div className="grid min-w-[260px] grid-cols-2 gap-px border border-[var(--border)] bg-[var(--border)]">
          <div className="bg-[var(--bg-darker)] p-3">
            <div className="terminal-label mb-1">Score</div>
            <div className="font-mono text-[24px] font-semibold text-[var(--value-bright)]">{market.score}</div>
          </div>
          <div className="bg-[var(--bg-darker)] p-3">
            <div className="terminal-label mb-1">Clock</div>
            <div className="flex items-center gap-2 font-mono text-[24px] font-semibold text-[var(--value-bright)]">
              <Clock3 size={19} strokeWidth={1.8} />
              {market.minute}
            </div>
          </div>
          <div className="bg-[var(--bg-darker)] p-3">
            <div className="terminal-label mb-1">Status</div>
            <StatusPill variant={market.status === 'live' ? 'live' : market.status === 'settling' ? 'warn' : 'neutral'} dot={market.status === 'live'}>
              {market.status}
            </StatusPill>
          </div>
          <div className="bg-[var(--bg-darker)] p-3">
            <div className="terminal-label mb-1">On-chain</div>
            <a className="inline-flex items-center gap-1.5 font-mono text-[13px] text-[var(--value)]" href="#activity">
              Pool receipt
              <ExternalLink size={13} strokeWidth={1.8} />
            </a>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-px border border-[var(--border)] bg-[var(--border)] md:grid-cols-2">
        {market.sides.map((side, index) => (
          <article className="bg-[var(--panel)] p-4" key={side.code}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="terminal-label mb-2">{index === 0 ? 'Side A' : 'Side B'}</div>
                <div className="font-mono text-[21px] font-semibold text-[var(--value-bright)]">{side.name}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-[28px] font-semibold leading-none text-[var(--value-bright)]">
                  ${side.price.toFixed(2)}
                </div>
                <div className="mt-2 text-[12px] text-[var(--muted)]">mark price</div>
              </div>
            </div>
            <ProgressBar value={side.conviction} tone={index === 0 ? 'mint' : 'amber'} />
            <div className="mt-4 grid grid-cols-3 gap-px bg-[var(--border-soft)]">
              <div className="bg-[var(--bg-darker)] p-2">
                <div className="terminal-label">Liquidity</div>
                <div className="mt-1 font-mono text-[var(--value)]">{formatCurrency(side.liquidity)}</div>
              </div>
              <div className="bg-[var(--bg-darker)] p-2">
                <div className="terminal-label">Conviction</div>
                <div className="mt-1 font-mono text-[var(--value)]">{side.conviction}%</div>
              </div>
              <div className="bg-[var(--bg-darker)] p-2">
                <div className="terminal-label">Receipt</div>
                <div className="mt-1 flex items-center gap-1.5 font-mono text-[var(--value)]">
                  <ShieldCheck size={13} strokeWidth={1.8} />
                  v4
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[var(--border-soft)] pt-4 font-mono text-[12px] text-[var(--muted)]">
        <Trophy size={15} className="text-[var(--label)]" strokeWidth={1.8} />
        {market.note}
      </div>
    </section>
  )
}
