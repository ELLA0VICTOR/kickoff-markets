import { ArrowUpRight, Clock3 } from 'lucide-react'
import type { MatchMarket } from '../../data/markets'
import { formatCurrency, formatSigned } from '../../lib/format'
import { ProgressBar } from '../ui/ProgressBar'
import { StatusPill } from '../ui/StatusPill'

type MatchMarketTableProps = {
  markets: MatchMarket[]
  selectedMarketId: string
  onSelectMarket: (marketId: string) => void
}

function statusVariant(status: MatchMarket['status']) {
  if (status === 'live') return 'live'
  if (status === 'settling') return 'warn'
  return 'neutral'
}

export function MatchMarketTable({ markets, selectedMarketId, onSelectMarket }: MatchMarketTableProps) {
  return (
    <div className="overflow-x-auto terminal-scrollbar">
      <table className="data-table min-w-[920px]">
        <thead>
          <tr>
            <th>Market</th>
            <th>Clock</th>
            <th>Price A</th>
            <th>Price B</th>
            <th>Liquidity</th>
            <th>Hook Fee</th>
            <th>Conviction</th>
          </tr>
        </thead>
        <tbody>
          {markets.map((market) => {
            const isSelected = market.id === selectedMarketId
            return (
              <tr
                className={isSelected ? 'bg-[var(--panel)]' : ''}
                key={market.id}
                onClick={() => onSelectMarket(market.id)}
              >
                <td>
                  <button
                    className="flex w-full items-center gap-3 text-left"
                    type="button"
                    onClick={() => onSelectMarket(market.id)}
                  >
                    <span className="team-code">{market.sides[0].code}</span>
                    <span className="min-w-0">
                      <span className="block font-mono text-[13px] font-semibold text-[var(--value-bright)]">
                        {market.sides[0].name} / {market.sides[1].name}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[12px] text-[var(--muted)]">
                        {market.stage}
                        <ArrowUpRight size={13} strokeWidth={1.8} />
                      </span>
                    </span>
                  </button>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <Clock3 size={14} className="text-[var(--label)]" strokeWidth={1.8} />
                    <span className="font-mono text-[var(--text-bright)]">{market.minute}</span>
                    <StatusPill variant={statusVariant(market.status)} dot={market.status === 'live'}>
                      {market.status}
                    </StatusPill>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-[var(--muted)]">{market.score}</div>
                </td>
                <td>
                  <div className="font-mono text-[var(--value-bright)]">${market.sides[0].price.toFixed(2)}</div>
                  <div className={market.sides[0].change >= 0 ? 'text-[var(--accent)]' : 'text-[var(--danger)]'}>
                    {formatSigned(market.sides[0].change)}
                  </div>
                </td>
                <td>
                  <div className="font-mono text-[var(--value-bright)]">${market.sides[1].price.toFixed(2)}</div>
                  <div className={market.sides[1].change >= 0 ? 'text-[var(--accent)]' : 'text-[var(--danger)]'}>
                    {formatSigned(market.sides[1].change)}
                  </div>
                </td>
                <td className="font-mono text-[var(--value)]">{formatCurrency(market.liquidity)}</td>
                <td>
                  <span className="font-mono text-[var(--label)]">{market.hookFeeBps} bps</span>
                  <span className="ml-2 text-[var(--muted)]">base {market.baseFeeBps}</span>
                </td>
                <td>
                  <div className="space-y-1.5">
                    <ProgressBar label={market.sides[0].code} value={market.sides[0].conviction} />
                    <ProgressBar label={market.sides[1].code} value={market.sides[1].conviction} tone="amber" />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
