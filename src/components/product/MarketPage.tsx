import { ArrowLeft, CheckCircle2, Clock3, Droplets, ExternalLink, Radio, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { explorerTxUrl } from '../../config/contracts'
import type { ActivityRow, HookStep, MatchMarket, PositionRow } from '../../data/markets'
import { formatCurrency, formatNumber } from '../../lib/format'
import type { ActionStatus } from '../../types/integration'
import { MatchPoster } from './MatchPoster'

type DetailTab = 'Trade' | 'Liquidity' | 'Hook' | 'Activity'

type MarketPageProps = {
  market: MatchMarket
  activityRows: ActivityRow[]
  actionStatus: ActionStatus
  contractReady: boolean
  hookSteps: HookStep[]
  positions: PositionRow[]
  onAddLiquidity: (market: MatchMarket, sideIndex: number, amount: string) => void
  onBack: () => void
  onClaim: (market: MatchMarket) => void
  onPlaceTrade: (market: MatchMarket, sideIndex: number, amount: string) => void
}

const detailTabs: DetailTab[] = ['Trade', 'Liquidity', 'Hook', 'Activity']

export function MarketPage({
  market,
  activityRows,
  actionStatus,
  contractReady,
  hookSteps,
  positions,
  onAddLiquidity,
  onBack,
  onClaim,
  onPlaceTrade,
}: MarketPageProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('Trade')
  const [sideIndex, setSideIndex] = useState<0 | 1>(0)
  const [amount, setAmount] = useState('250')
  const [liquidityAmount, setLiquidityAmount] = useState('1000')
  const selectedSide = market.sides[sideIndex]
  const amountNumber = Number(amount) || 0

  const estimatedReceipts = useMemo(() => amountNumber / selectedSide.price, [amountNumber, selectedSide.price])

  return (
    <main className="market-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} strokeWidth={1.8} />
        Markets
      </button>

      <div className={contractReady ? 'integration-strip is-onchain' : 'integration-strip'}>
        <span>{contractReady ? 'On-chain mode' : 'Demo mode'}</span>
        <strong>
          {contractReady
            ? 'Trades and liquidity submit to the configured KickoffMarkets contract.'
            : 'Set VITE_KICKOFF_MARKETS_ADDRESS to route actions to X Layer.'}
        </strong>
      </div>

      <section className="detail-hero">
        <div className="detail-visual">
          <MatchPoster market={market} size="hero" />
        </div>

        <div className="detail-summary">
          <div className="market-card-tags">
            <span>{market.stage}</span>
            <strong>{market.status}</strong>
          </div>
          <h1>
            {market.sides[0].name} vs {market.sides[1].name}
          </h1>

          <div className="score-strip">
            <strong>{market.score}</strong>
            <span>{market.minute}</span>
            <span>{market.pool}</span>
          </div>

          <div className="detail-stats">
            <Stat icon={<Droplets size={16} strokeWidth={1.8} />} label="Liquidity" value={formatCurrency(market.liquidity)} />
            <Stat icon={<Radio size={16} strokeWidth={1.8} />} label="Hook fee" value={`${market.hookFeeBps} bps`} />
            <Stat icon={<Clock3 size={16} strokeWidth={1.8} />} label="Trades" value={formatNumber(market.xLayerTx)} />
          </div>
        </div>
      </section>

      <nav className="detail-tabs" aria-label="Market detail sections">
        {detailTabs.map((tab) => (
          <button
            className={activeTab === tab ? 'is-active' : ''}
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {activeTab === 'Trade' ? (
        <section className="trade-layout">
          <div className="outcome-panel">
            {market.sides.map((side, index) => (
              <button
                className={sideIndex === index ? 'outcome-card is-active' : 'outcome-card'}
                key={side.code}
                type="button"
                onClick={() => setSideIndex(index as 0 | 1)}
              >
                <span>{side.code}</span>
                <strong>{side.name}</strong>
                <em>${side.price.toFixed(2)}</em>
              </button>
            ))}
          </div>

          <aside className="ticket-panel">
            <label>
              <span>Amount</span>
              <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" />
            </label>
            <div className="ticket-summary">
              <Row label="Buying" value={selectedSide.name} />
              <Row label="Receipts" value={estimatedReceipts.toFixed(2)} />
              <Row label="Fee" value={`${market.hookFeeBps} bps`} />
            </div>
            <button className="primary-action" type="button" onClick={() => onPlaceTrade(market, sideIndex, amount)}>
              Place trade
            </button>
            <ActionNotice status={actionStatus} />
          </aside>
        </section>
      ) : null}

      {activeTab === 'Liquidity' ? (
        <section className="simple-grid">
          {market.sides.map((side, index) => (
            <div className="info-panel" key={side.code}>
              <span>{side.code}</span>
              <strong>{formatCurrency(side.liquidity)}</strong>
              <small>{side.conviction}% conviction</small>
              <button type="button" onClick={() => onAddLiquidity(market, index, liquidityAmount)}>
                Add LP
              </button>
            </div>
          ))}
          <div className="info-panel liquidity-ticket">
            <span>LP amount</span>
            <input value={liquidityAmount} onChange={(event) => setLiquidityAmount(event.target.value)} inputMode="decimal" />
            <small>USDC routed as liquidity receipt</small>
          </div>
          {positions.map((position) => (
            <div className="info-panel" key={`${position.market}-${position.side}`}>
              <span>{position.side}</span>
              <strong>{position.pnl}</strong>
              <small>{position.status}</small>
              {position.status === 'claimable' ? (
                <button type="button" onClick={() => onClaim(market)}>
                  Claim
                </button>
              ) : null}
            </div>
          ))}
          <ActionNotice status={actionStatus} />
        </section>
      ) : null}

      {activeTab === 'Hook' ? (
        <section className="hook-grid">
          {hookSteps.map((step) => (
            <div className={step.state === 'active' ? 'hook-step is-active' : 'hook-step'} key={step.marker}>
              <span>{step.marker}</span>
              <strong>{step.title}</strong>
              <small>{step.fee}</small>
            </div>
          ))}
        </section>
      ) : null}

      {activeTab === 'Activity' ? (
        <section className="activity-list">
          {activityRows.map((row) => (
            <div className="activity-row" key={`${row.time}-${row.tx}`}>
              <span>{row.time}</span>
              <strong>{row.kind}</strong>
              <em>{row.market}</em>
              <small>{row.amount}</small>
              {row.status === 'confirmed' ? <CheckCircle2 size={15} strokeWidth={1.8} /> : <ShieldCheck size={15} strokeWidth={1.8} />}
            </div>
          ))}
        </section>
      ) : null}
    </main>
  )
}

function ActionNotice({ status }: { status: ActionStatus }) {
  if (status.state === 'idle') return null

  const txUrl = explorerTxUrl(status.txHash)

  return (
    <div className={`action-notice state-${status.state}`}>
      <span>{status.state}</span>
      <strong>{status.message}</strong>
      {txUrl ? (
        <a href={txUrl} target="_blank" rel="noreferrer">
          View tx
          <ExternalLink size={13} strokeWidth={1.8} />
        </a>
      ) : null}
    </div>
  )
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      <span>
        {icon}
        {label}
      </span>
      <strong>{value}</strong>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
