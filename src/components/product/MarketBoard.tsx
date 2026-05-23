import type { MatchMarket } from '../../data/markets'
import { MarketCard } from './MarketCard'

type MarketBoardProps = {
  markets: MatchMarket[]
  selectedMarketId: string
  onMarketSelect: (id: string) => void
  onCreateClick: () => void
}

export function MarketBoard({ markets, selectedMarketId, onMarketSelect, onCreateClick }: MarketBoardProps) {
  return (
    <main className="market-board">
      <div className="board-header">
        <div>
          <span>Markets</span>
          <h1>Matches</h1>
        </div>
        <div className="board-actions">
          <div className="feed-chip">X Layer feed</div>
          <button className="create-button" type="button" onClick={onCreateClick}>
            Create room
          </button>
        </div>
      </div>

      {markets.length > 0 ? (
        <div className="market-grid">
          {markets.map((market) => (
            <MarketCard
              active={market.id === selectedMarketId}
              key={market.id}
              market={market}
              onSelect={onMarketSelect}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>No matches found</h2>
        </div>
      )}
    </main>
  )
}
