import { useMemo, useState } from 'react'
import { PoolActivityTable } from './components/activity/PoolActivityTable'
import { PositionsTable } from './components/activity/PositionsTable'
import { HookTimeline } from './components/hook/HookTimeline'
import { TerminalShell } from './components/layout/TerminalShell'
import { MarketMetrics } from './components/markets/MarketMetrics'
import { MatchMarketTable } from './components/markets/MatchMarketTable'
import { MatchRoom } from './components/markets/MatchRoom'
import { ProductHeader } from './components/overview/ProductHeader'
import { TradeTicket } from './components/trading/TradeTicket'
import { SectionHeader } from './components/ui/SectionHeader'
import { StatusPill } from './components/ui/StatusPill'
import { activityRows, hookSteps, markets, positions } from './data/markets'

function App() {
  const [selectedMarketId, setSelectedMarketId] = useState(markets[0].id)

  const selectedMarket = useMemo(
    () => markets.find((market) => market.id === selectedMarketId) ?? markets[0],
    [selectedMarketId],
  )

  return (
    <TerminalShell>
      <ProductHeader selectedMarket={selectedMarket} marketCount={markets.length} />

      <div className="mt-6">
        <MarketMetrics market={selectedMarket} />
      </div>

      <section className="mt-6" id="markets">
        <SectionHeader
          number="1)"
          title="Match Markets - Live Rooms, Pool Fees, Conviction"
          action={
            <StatusPill variant="live" dot>
              auto-refresh 15s
            </StatusPill>
          }
        />
        <MatchMarketTable
          markets={markets}
          onSelectMarket={setSelectedMarketId}
          selectedMarketId={selectedMarketId}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <MatchRoom market={selectedMarket} />
        <TradeTicket market={selectedMarket} />
      </section>

      <div className="mt-6">
        <SectionHeader number="2)" title="Hook Control Surface - Fee Logic, Oracle State, Settlement Lane" />
        <HookTimeline market={selectedMarket} steps={hookSteps} />
      </div>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_480px]">
        <div id="activity">
          <SectionHeader
            number="3)"
            title="Pool Activity - Receipt Visible X Layer Flow"
            action={<StatusPill variant="success">verified</StatusPill>}
          />
          <PoolActivityTable rows={activityRows} />
        </div>

        <div id="liquidity">
          <SectionHeader number="4)" title="Positions - User Exposure And Claims" />
          <PositionsTable rows={positions} />
        </div>
      </section>
    </TerminalShell>
  )
}

export default App
