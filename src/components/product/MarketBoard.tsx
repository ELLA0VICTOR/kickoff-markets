import type { MatchMarket } from '../../data/markets'
import type { ActionStatus } from '../../types/integration'
import { MarketCard } from './MarketCard'

type MarketBoardProps = {
  actionStatus: ActionStatus
  collateralBalance?: number
  contractReady: boolean
  loading: boolean
  loadError?: string
  markets: MatchMarket[]
  selectedMarketId?: string
  onMarketSelect: (id: string) => void
  onCreateClick: () => void
  onFaucetClick: () => void
  onSeedFixtures: () => void
}

export function MarketBoard({
  actionStatus,
  collateralBalance,
  contractReady,
  loading,
  loadError,
  markets,
  selectedMarketId,
  onMarketSelect,
  onCreateClick,
  onFaucetClick,
  onSeedFixtures,
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
          {contractReady ? (
            <button className="feed-chip feed-button" type="button" onClick={onSeedFixtures}>
              Seed WC fixtures
            </button>
          ) : null}
          <button className="create-button" type="button" onClick={onCreateClick}>
            Create room
          </button>
        </div>
      </div>

      {actionStatus.state !== 'idle' ? (
        <div className={`action-notice board-notice state-${actionStatus.state}`}>
          <span>{actionStatus.state}</span>
          <strong>{actionStatus.message}</strong>
        </div>
      ) : null}

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
