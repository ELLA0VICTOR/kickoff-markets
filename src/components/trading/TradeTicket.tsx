import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, Settings2, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { MatchMarket } from '../../data/markets'
import { StatusPill } from '../ui/StatusPill'

type TradeTicketProps = {
  market: MatchMarket
}

export function TradeTicket({ market }: TradeTicketProps) {
  const [sideIndex, setSideIndex] = useState<0 | 1>(0)
  const [mode, setMode] = useState<'buy' | 'sell'>('buy')
  const [amount, setAmount] = useState('250')
  const selectedSide = market.sides[sideIndex]
  const amountNumber = Number(amount) || 0

  const estimate = useMemo(() => {
    const shares = amountNumber / selectedSide.price
    const lpRebate = amountNumber * (market.hookFeeBps / 10_000) * 0.24
    return { shares, lpRebate }
  }, [amountNumber, market.hookFeeBps, selectedSide.price])

  return (
    <aside className="terminal-panel h-full">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="terminal-label mb-2">Trade Ticket</div>
          <h2 className="m-0 font-mono text-[20px] font-semibold text-[var(--value-bright)]">{market.pool}</h2>
        </div>
        <StatusPill variant="live" dot>
          Routed
        </StatusPill>
      </div>

      <div className="grid grid-cols-2 gap-px bg-[var(--border)]">
        {market.sides.map((side, index) => (
          <button
            className={[
              'bg-[var(--bg-darker)] p-3 text-left transition hover:bg-[var(--panel-2)]',
              sideIndex === index ? 'outline outline-1 outline-[var(--accent)]' : '',
            ].join(' ')}
            key={side.code}
            onClick={() => setSideIndex(index as 0 | 1)}
            type="button"
          >
            <div className="terminal-label mb-2">{side.code}</div>
            <div className="font-mono text-[15px] font-semibold text-[var(--value-bright)]">{side.name}</div>
            <div className="mt-2 font-mono text-[13px] text-[var(--value)]">${side.price.toFixed(2)}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className={`terminal-button justify-center ${mode === 'buy' ? 'is-active' : ''}`}
          onClick={() => setMode('buy')}
          type="button"
        >
          <ArrowDownLeft size={15} strokeWidth={1.8} />
          Buy
        </button>
        <button
          className={`terminal-button justify-center ${mode === 'sell' ? 'is-active' : ''}`}
          onClick={() => setMode('sell')}
          type="button"
        >
          <ArrowUpRight size={15} strokeWidth={1.8} />
          Sell
        </button>
      </div>

      <label className="mt-5 block">
        <span className="terminal-label mb-2 block">USDC Amount</span>
        <div className="flex items-center border border-[var(--border)] bg-[var(--bg-darker)]">
          <CircleDollarSign className="ml-3 text-[var(--label)]" size={17} strokeWidth={1.8} />
          <input
            className="h-12 min-w-0 flex-1 bg-transparent px-3 font-mono text-[22px] text-[var(--value-bright)] outline-none"
            inputMode="decimal"
            onChange={(event) => setAmount(event.target.value)}
            type="text"
            value={amount}
          />
          <span className="pr-3 font-mono text-[12px] text-[var(--muted)]">USDC</span>
        </div>
      </label>

      <div className="mt-5 space-y-2 border border-[var(--border)] bg-[var(--bg-darker)] p-3">
        <SummaryRow label="Order" value={`${mode.toUpperCase()} ${selectedSide.code}`} />
        <SummaryRow label="Est. Receipts" value={estimate.shares.toFixed(2)} />
        <SummaryRow label="Hook Fee" value={`${market.hookFeeBps} bps`} />
        <SummaryRow label="LP Rebate Route" value={`$${estimate.lpRebate.toFixed(2)}`} />
        <SummaryRow label="Settlement" value="X Layer v4 pool" />
      </div>

      <div className="mt-5 grid gap-2">
        <button className="terminal-primary-button" type="button">
          <Wallet size={16} strokeWidth={1.8} />
          Place {mode} order
        </button>
        <button className="terminal-button justify-center" type="button">
          <Settings2 size={16} strokeWidth={1.8} />
          Add liquidity instead
        </button>
      </div>

      <p className="mt-4 font-mono text-[12px] leading-relaxed text-[var(--muted)]">
        Orders are shown as signed receipts first, then finalized through the Match Clock Hook when pool state is current.
      </p>
    </aside>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 font-mono text-[12px]">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-right text-[var(--value)]">{value}</span>
    </div>
  )
}
