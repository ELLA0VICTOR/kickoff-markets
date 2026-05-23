import { Cable, ShieldCheck, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import type { MatchMarket } from '../../data/markets'
import { formatCurrency, formatNumber } from '../../lib/format'
import { StatusPill } from '../ui/StatusPill'

type ProductHeaderProps = {
  selectedMarket: MatchMarket
  marketCount: number
}

export function ProductHeader({ selectedMarket, marketCount }: ProductHeaderProps) {
  return (
    <section className="border-b border-[var(--border)] pb-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="terminal-label">World Cup Liquidity Terminal</div>
        <StatusPill variant="live" dot>
          Live on X Layer
        </StatusPill>
        <StatusPill variant="success">Uniswap v4 Hook</StatusPill>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
        <div>
          <h1 className="m-0 max-w-[980px] font-mono text-[32px] font-semibold leading-tight text-[var(--value-bright)] md:text-[42px]">
            Match-aware markets for World Cup trading rooms
          </h1>
          <p className="mt-4 max-w-[920px] text-[15px] leading-7 text-[var(--text)]">
            Kickoff Markets converts live match attention into X Layer swaps, LP deposits, and receipt-visible
            settlement. Each pool is governed by a Match Clock Hook that changes fees and incentives as the game
            moves from kickoff to final whistle.
          </p>
        </div>

        <div className="grid gap-px border border-[var(--border)] bg-[var(--border)] sm:grid-cols-3 xl:grid-cols-1">
          <HeaderFact
            icon={<Trophy size={16} strokeWidth={1.8} />}
            label="Open Rooms"
            value={`${marketCount} markets`}
          />
          <HeaderFact
            icon={<Cable size={16} strokeWidth={1.8} />}
            label="Selected Pool"
            value={selectedMarket.pool}
          />
          <HeaderFact
            icon={<ShieldCheck size={16} strokeWidth={1.8} />}
            label="Verifiable Flow"
            value={`${formatCurrency(selectedMarket.volume)} volume / ${formatNumber(selectedMarket.xLayerTx)} tx`}
          />
        </div>
      </div>
    </section>
  )
}

function HeaderFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 bg-[var(--bg-darker)] p-3">
      <span className="text-[var(--label)]">{icon}</span>
      <span className="min-w-0">
        <span className="terminal-label block">{label}</span>
        <span className="block truncate font-mono text-[13px] text-[var(--value)]">{value}</span>
      </span>
    </div>
  )
}
