export type MarketPhase = 'pre-match' | 'live' | 'halftime' | 'settlement'
export type MarketSettlement =
  | 'open'
  | 'proposed-cancel'
  | 'proposed-a'
  | 'proposed-b'
  | 'disputed'
  | 'cancelled'
  | 'side-a'
  | 'side-b'

export type FinalMarketSettlement = 'cancelled' | 'side-a' | 'side-b'

export type TeamSide = {
  code: string
  name: string
  price: number
  change: number
  liquidity: number
  conviction: number
}

export type MatchMarket = {
  id: string
  roomId: string
  stage: string
  kickoff: string
  phase: MarketPhase
  settlement: MarketSettlement
  minute: string
  score: string
  pool: string
  creator: string
  proposer: string
  status: 'live' | 'open' | 'settling' | 'settled' | 'cancelled'
  liquidity: number
  volume: number
  traders: number
  hookFeeBps: number
  baseFeeBps: number
  feePool: number
  claimableAmount: number
  disputeDeadline: number
  proposedOutcome: MarketSettlement
  xLayerTx: number
  note: string
  sides: [TeamSide, TeamSide]
  sparkline: number[]
}

export type RoomDraft = {
  teamA: string
  teamB: string
  kickoff: string
}

export type HookStep = {
  marker: string
  title: string
  fee: string
  incentive: string
  state: 'complete' | 'active' | 'pending'
}

export type ActivityRow = {
  time: string
  kind: string
  market: string
  wallet: string
  amount: string
  fee: string
  tx: string
  status: 'confirmed' | 'pending'
}

export type PositionRow = {
  market: string
  side: string
  size: string
  entry: string
  mark: string
  pnl: string
  status: 'open' | 'claimable'
}

export const hookSteps: HookStep[] = [
  {
    marker: 'T-24H',
    title: 'Liquidity boot',
    fee: '18 bps',
    incentive: 'Lower fees attract early LP collateral',
    state: 'complete',
  },
  {
    marker: 'T-30M',
    title: 'Pre-match discovery',
    fee: '22 bps',
    incentive: 'Odds form before kickoff',
    state: 'complete',
  },
  {
    marker: 'LIVE',
    title: 'Match clock fee',
    fee: '46 bps',
    incentive: 'Volatility fees route into the LP reward pool',
    state: 'active',
  },
  {
    marker: 'FT',
    title: 'Settlement lane',
    fee: '12 bps',
    incentive: 'Claims unlock after creator settlement',
    state: 'pending',
  },
]
