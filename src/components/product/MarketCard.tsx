import { Clock3, Droplets, Radio } from 'lucide-react'
import type { MatchMarket } from '../../data/markets'
import { formatCurrency } from '../../lib/format'
import { MatchPoster } from './MatchPoster'

type MarketCardProps = {
  market: MatchMarket
  active: boolean
  onSelect: (id: string) => void
}

export function MarketCard({ market, active, onSelect }: MarketCardProps) {
  return (
    <button className={active ? 'market-card is-active' : 'market-card'} type="button" onClick={() => onSelect(market.id)}>
      <div className="market-card-tags">
        <span>{market.stage}</span>
        <strong>{market.status}</strong>
      </div>

      <div className="market-card-body">
        <MatchPoster market={market} />
        <h3>
          {market.sides[0].name} vs {market.sides[1].name}
        </h3>

        <div className="price-row">
          <span>
            {market.sides[0].code}
            <strong>${market.sides[0].price.toFixed(2)}</strong>
          </span>
          <span>
            {market.sides[1].code}
            <strong>${market.sides[1].price.toFixed(2)}</strong>
          </span>
        </div>
      </div>

      <div className="market-card-footer">
        <span>
          <Droplets size={15} strokeWidth={1.8} />
          {formatCurrency(market.liquidity)}
        </span>
        <span>
          <Clock3 size={15} strokeWidth={1.8} />
          {market.minute}
        </span>
        <span>
          <Radio size={15} strokeWidth={1.8} />
          {market.hookFeeBps} bps
        </span>
      </div>
    </button>
  )
}
