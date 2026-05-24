import { ArrowLeft, CheckCircle2, Clock3, Droplets, ExternalLink, Radio, ShieldCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { explorerTxUrl } from '../../config/contracts'
import type { ActivityRow, FinalMarketSettlement, HookStep, MarketPhase, MatchMarket, PositionRow } from '../../data/markets'
import { formatCurrency, formatNumber } from '../../lib/format'
import { getOracleStatus } from '../../lib/oracleStatus'
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
  walletAddress?: string
  onAddLiquidity: (market: MatchMarket, sideIndex: number, amount: string) => void
  onBack: () => void
  onClaim: (market: MatchMarket) => void
  onDispute: (market: MatchMarket) => void
  onFinalize: (market: MatchMarket) => void
  onPlaceTrade: (market: MatchMarket, sideIndex: number, amount: string) => void
  onResolveDispute: (market: MatchMarket, outcome: FinalMarketSettlement, score: string, clock: string) => void
  onSettle: (market: MatchMarket, outcome: FinalMarketSettlement, score: string, clock: string) => void
  onUpdatePhase: (market: MatchMarket, phase: MarketPhase, clock: string, score: string, feeBps: number) => void
}

const detailTabs: DetailTab[] = ['Trade', 'Liquidity', 'Hook', 'Activity']

export function MarketPage({
  market,
  activityRows,
  actionStatus,
  contractReady,
  hookSteps,
  positions,
  walletAddress,
  onAddLiquidity,
  onBack,
  onClaim,
  onDispute,
  onFinalize,
  onPlaceTrade,
  onResolveDispute,
  onSettle,
  onUpdatePhase,
}: MarketPageProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>('Trade')
  const [sideIndex, setSideIndex] = useState<0 | 1>(0)
  const [amount, setAmount] = useState('250')
  const [liquidityAmount, setLiquidityAmount] = useState('1000')
  const [now, setNow] = useState(() => Date.now())
  const [clockDraft, setClockDraft] = useState({
    feeBps: String(market.hookFeeBps),
    marketId: market.id,
    clock: market.minute,
    score: market.score,
  })
  const clock = clockDraft.marketId === market.id ? clockDraft.clock : market.minute
  const feeBps = clockDraft.marketId === market.id ? clockDraft.feeBps : String(market.hookFeeBps)
  const score = clockDraft.marketId === market.id ? clockDraft.score : market.score
  const selectedSide = market.sides[sideIndex]
  const amountNumber = Number(amount) || 0
  const canManage =
    Boolean(walletAddress) && walletAddress?.toLowerCase() === market.creator.toLowerCase() && market.settlement === 'open'
  const canResolve =
    Boolean(walletAddress) &&
    walletAddress?.toLowerCase() === market.creator.toLowerCase() &&
    market.settlement === 'disputed'
  const canDispute = Boolean(walletAddress) && market.settlement.startsWith('proposed')
  const canFinalize = market.settlement.startsWith('proposed')
  const roomOpen = market.settlement === 'open'
  const canTrade = contractReady && roomOpen && market.liquidity > 0
  const oracleStatus = getOracleStatus(market, now)
  const settlementVerb = oracleStatus.fallbackEnabled ? 'Fallback' : 'Propose'

  const estimatedReceipts = useMemo(() => amountNumber / selectedSide.price, [amountNumber, selectedSide.price])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  function updateClockDraft(next: Partial<typeof clockDraft>) {
    setClockDraft({
      feeBps,
      marketId: market.id,
      clock,
      score,
      ...next,
    })
  }

  return (
    <main className="market-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ArrowLeft size={17} strokeWidth={1.8} />
        Markets
      </button>

      <div className={contractReady ? 'integration-strip is-onchain' : 'integration-strip'}>
        <span>{contractReady ? 'Escrow live' : 'Contract setup'}</span>
        <strong>
          {contractReady
            ? 'Trades, liquidity, settlement, and claims use X Layer contracts.'
            : 'Deploy KickoffMarkets with collateral, then set both contract addresses.'}
        </strong>
      </div>

      <div className={`oracle-strip oracle-${oracleStatus.kind}`}>
        <span>{oracleStatus.label}</span>
        <strong>{oracleStatus.detail}</strong>
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
              <Row label="Est. shares" value={estimatedReceipts.toFixed(2)} />
              <Row label="Fee" value={`${market.hookFeeBps} bps`} />
            </div>
            <button
              className="primary-action"
              type="button"
              disabled={!canTrade}
              onClick={() => onPlaceTrade(market, sideIndex, amount)}
            >
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
              <button type="button" disabled={!contractReady || !roomOpen} onClick={() => onAddLiquidity(market, index, liquidityAmount)}>
                Add LP
              </button>
            </div>
          ))}
          <div className="info-panel liquidity-ticket">
            <span>LP amount</span>
            <input value={liquidityAmount} onChange={(event) => setLiquidityAmount(event.target.value)} inputMode="decimal" />
            <small>USDC seeds both outcome reserves</small>
          </div>
          {positions.map((position) => (
            <div className="info-panel" key={`${position.market}-${position.side}`}>
              <span>{position.side}</span>
              <strong>{position.pnl}</strong>
              <small>{position.status}</small>
              {position.status === 'claimable' ? (
                <button type="button" disabled={!contractReady} onClick={() => onClaim(market)}>
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
          <div className="info-panel oracle-panel">
            <span>Match Clock</span>
            <strong>{oracleStatus.label}</strong>
            <small>{oracleStatus.detail}</small>
            <input value={clock} onChange={(event) => updateClockDraft({ clock: event.target.value })} aria-label="Match clock" />
            <input value={score} onChange={(event) => updateClockDraft({ score: event.target.value })} aria-label="Score" />
            <input
              value={feeBps}
              onChange={(event) => updateClockDraft({ feeBps: event.target.value })}
              aria-label="Fee bps"
              inputMode="numeric"
            />
            <div className="oracle-actions">
              <button
                type="button"
                disabled={!canManage}
                onClick={() => onUpdatePhase(market, 'live', clock, score, Number(feeBps) || market.hookFeeBps)}
              >
                Set live
              </button>
              <button
                type="button"
                disabled={!canManage}
                onClick={() => onUpdatePhase(market, 'halftime', clock, score, Number(feeBps) || market.hookFeeBps)}
              >
                Halftime
              </button>
              <button type="button" disabled={!canManage} onClick={() => onSettle(market, 'side-a', score, clock)}>
                {settlementVerb} {market.sides[0].code}
              </button>
              <button type="button" disabled={!canManage} onClick={() => onSettle(market, 'side-b', score, clock)}>
                {settlementVerb} {market.sides[1].code}
              </button>
              <button type="button" disabled={!canManage} onClick={() => onSettle(market, 'cancelled', score, clock)}>
                {settlementVerb} void
              </button>
              <button type="button" disabled={!canDispute} onClick={() => onDispute(market)}>
                Dispute
              </button>
              <button type="button" disabled={!canFinalize} onClick={() => onFinalize(market)}>
                Finalize
              </button>
              <button type="button" disabled={!canResolve} onClick={() => onResolveDispute(market, 'side-a', score, clock)}>
                Resolve {market.sides[0].code}
              </button>
              <button type="button" disabled={!canResolve} onClick={() => onResolveDispute(market, 'side-b', score, clock)}>
                Resolve {market.sides[1].code}
              </button>
            </div>
          </div>
          <ActionNotice status={actionStatus} />
        </section>
      ) : null}

      {activeTab === 'Activity' ? (
        <section className="activity-list">
          {activityRows.length > 0 ? (
            activityRows.map((row) => (
              <div className="activity-row" key={`${row.time}-${row.tx}-${row.kind}`}>
                <span>{row.time}</span>
                <strong>{row.kind}</strong>
                <em>{row.market}</em>
                <small>{row.amount}</small>
                {row.status === 'confirmed' ? <CheckCircle2 size={15} strokeWidth={1.8} /> : <ShieldCheck size={15} strokeWidth={1.8} />}
              </div>
            ))
          ) : (
            <div className="activity-row">
              <span>-</span>
              <strong>EMPTY</strong>
              <em>{market.pool}</em>
              <small>No X Layer events yet</small>
              <ShieldCheck size={15} strokeWidth={1.8} />
            </div>
          )}
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
