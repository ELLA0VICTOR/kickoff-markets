import type { MatchMarket } from '../../data/markets'
import { LoadingMark } from './LoadingMark'
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
  const hasMarkets = markets.length > 0

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

      {loading && hasMarkets ? (
        <div className="sync-strip">
          <LoadingMark size="small" label="Syncing X Layer rooms" />
          <span>Syncing X Layer rooms</span>
        </div>
      ) : null}

      {loadError && hasMarkets ? (
        <div className="sync-strip state-error">
          <span>{loadError}</span>
        </div>
      ) : null}

      {hasMarkets ? (
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
      ) : loading ? (
        <div className="empty-state">
          <LoadingMark label="Reading X Layer rooms" />
          <h2>Reading X Layer rooms</h2>
        </div>
      ) : loadError ? (
        <div className="empty-state">
          <h2>{loadError}</h2>
        </div>
      ) : (
        <div className="empty-state">
          <h2>No on-chain rooms yet</h2>
        </div>
      )}
    </main>
  )
}
