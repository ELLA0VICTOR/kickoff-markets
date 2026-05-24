import type { MatchMarket } from '../../data/markets'
import { MarketCard } from './MarketCard'

type MarketBoardProps = {
  collateralBalance?: number
  contractReady: boolean
  loading: boolean
  loadError?: string
  markets: MatchMarket[]
  selectedMarketId?: string
  onMarketSelect: (id: string) => void
  onCreateClick: () => void
  onFaucetClick: () => void
}

export function MarketBoard({
  collateralBalance,
  contractReady,
  loading,
  loadError,
  markets,
  selectedMarketId,
  onMarketSelect,
  onCreateClick,
  onFaucetClick,
}: MarketBoardProps) {
  return (
    <main className="market-board">
      <div className="board-header">
        <div>
          <span>Markets</span>
          <h1>Matches</h1>
        </div>
        <div className="board-actions">
          <div className="feed-chip">{collateralBalance === undefined ? 'X Layer feed' : `${collateralBalance.toFixed(2)} kUSDC`}</div>
          {contractReady ? (
            <button className="feed-chip feed-button" type="button" onClick={onFaucetClick}>
              Faucet collateral
            </button>
          ) : null}
          <button className="create-button" type="button" onClick={onCreateClick}>
            Create room
          </button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <h2>Reading X Layer rooms</h2>
        </div>
      ) : loadError ? (
        <div className="empty-state">
          <h2>{loadError}</h2>
        </div>
      ) : markets.length > 0 ? (
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
          <h2>No on-chain rooms yet</h2>
        </div>
      )}
    </main>
  )
}
