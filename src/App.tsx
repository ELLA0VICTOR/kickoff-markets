import { useMemo, useState } from 'react'
import { AppTopbar } from './components/product/AppTopbar'
import { type HomeTab, MarketTabs } from './components/product/MarketTabs'
import { MarketBoard } from './components/product/MarketBoard'
import { MarketPage } from './components/product/MarketPage'
import { activityRows, hookSteps, markets, positions } from './data/markets'
import type { MatchMarket } from './data/markets'

function matchesTab(market: MatchMarket, tab: HomeTab) {
  if (tab === 'All') return true
  if (tab === 'Live') return market.status === 'live'
  if (tab === 'Upcoming') return market.status === 'open'
  if (tab === 'Settling') return market.status === 'settling'

  return true
}

function matchesSearch(market: MatchMarket, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  return [market.sides[0].name, market.sides[1].name, market.sides[0].code, market.sides[1].code, market.stage, market.pool]
    .join(' ')
    .toLowerCase()
    .includes(normalized)
}

function App() {
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<HomeTab>('All')
  const [selectedMarketId, setSelectedMarketId] = useState(markets[0].id)
  const [detailMarketId, setDetailMarketId] = useState<string>()

  const filteredMarkets = useMemo(
    () => markets.filter((market) => matchesTab(market, activeTab) && matchesSearch(market, query)),
    [activeTab, query],
  )

  const selectedMarket = useMemo(
    () => markets.find((market) => market.id === (detailMarketId || selectedMarketId)) ?? markets[0],
    [detailMarketId, selectedMarketId],
  )

  function selectMarket(id: string) {
    setSelectedMarketId(id)
    setDetailMarketId(id)
  }

  return (
    <div className="app-shell">
      <AppTopbar query={query} onQueryChange={setQuery} />

      {detailMarketId ? (
        <MarketPage
          activityRows={activityRows}
          hookSteps={hookSteps}
          market={selectedMarket}
          positions={positions}
          onBack={() => setDetailMarketId(undefined)}
        />
      ) : (
        <>
          <MarketTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <MarketBoard markets={filteredMarkets} selectedMarketId={selectedMarketId} onMarketSelect={selectMarket} />
        </>
      )}
    </div>
  )
}

export default App
