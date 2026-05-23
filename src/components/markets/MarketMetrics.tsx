import { Activity, Gauge, Layers3, Radio, Users } from 'lucide-react'
import type { MatchMarket } from '../../data/markets'
import { formatCurrency, formatNumber } from '../../lib/format'
import { MetricCard } from '../ui/MetricCard'
import { StatusPill } from '../ui/StatusPill'

type MarketMetricsProps = {
  market: MatchMarket
}

export function MarketMetrics({ market }: MarketMetricsProps) {
  return (
    <section className="metrics-strip" aria-label="Selected market metrics">
      <MetricCard
        label="Pool Liquidity"
        value={formatCurrency(market.liquidity)}
        badge={
          <StatusPill variant="live" dot>
            Live
          </StatusPill>
        }
        sparkline={market.sparkline}
        sub={
          <span className="inline-flex items-center gap-2">
            <Layers3 size={13} strokeWidth={1.8} />
            {market.pool} on X Layer
          </span>
        }
      />
      <MetricCard
        label="Match Volume"
        value={formatCurrency(market.volume)}
        badge={<Activity size={16} className="text-[var(--value)]" strokeWidth={1.8} />}
        sparkline={market.sparkline.map((value) => value * 1.35)}
        sub="Swaps, LP adds, claims, and hook updates"
      />
      <MetricCard
        label="Traders"
        value={formatNumber(market.traders)}
        badge={<Users size={16} className="text-[var(--value)]" strokeWidth={1.8} />}
        sub={`${formatNumber(market.xLayerTx)} X Layer tx routed through this room`}
      />
      <MetricCard
        label="Hook Fee"
        value={String(market.hookFeeBps)}
        unit="bps"
        tone="amber"
        badge={<Gauge size={16} className="text-[var(--label)]" strokeWidth={1.8} />}
        sparkline={[18, 18, 22, 22, 31, market.hookFeeBps, market.hookFeeBps]}
        sub={`Base fee ${market.baseFeeBps} bps; match clock is ${market.phase}`}
      />
      <MetricCard
        label="Phase"
        value={market.minute}
        badge={<Radio size={16} className="text-[var(--accent)]" strokeWidth={1.8} />}
        sub={market.note}
      />
    </section>
  )
}
