export type MarketPhase = 'pre-match' | 'live' | 'halftime' | 'settlement'

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
  stage: string
  kickoff: string
  phase: MarketPhase
  minute: string
  score: string
  pool: string
  status: 'live' | 'open' | 'settling'
  liquidity: number
  volume: number
  traders: number
  hookFeeBps: number
  baseFeeBps: number
  xLayerTx: number
  note: string
  sides: [TeamSide, TeamSide]
  sparkline: number[]
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

export const markets: MatchMarket[] = [
  {
    id: 'arg-fra-final',
    stage: 'Final room',
    kickoff: '20:00 UTC',
    phase: 'live',
    minute: "63'",
    score: '1 - 1',
    pool: 'ARG/FRA-v4',
    status: 'live',
    liquidity: 842_600,
    volume: 3_420_800,
    traders: 12_482,
    hookFeeBps: 46,
    baseFeeBps: 18,
    xLayerTx: 38_941,
    note: 'Match Clock Hook lifted fees after the equalizer and is routing the surge into LP rewards.',
    sides: [
      { code: 'ARG', name: 'Argentina', price: 0.52, change: 4.8, liquidity: 438_200, conviction: 58 },
      { code: 'FRA', name: 'France', price: 0.48, change: -3.1, liquidity: 404_400, conviction: 42 },
    ],
    sparkline: [38, 41, 39, 44, 48, 47, 51, 55, 53, 58, 61, 66],
  },
  {
    id: 'bra-eng-quarter',
    stage: 'Quarterfinal room',
    kickoff: '18:00 UTC',
    phase: 'pre-match',
    minute: 'T-42m',
    score: '0 - 0',
    pool: 'BRA/ENG-v4',
    status: 'open',
    liquidity: 516_900,
    volume: 1_920_300,
    traders: 7_118,
    hookFeeBps: 22,
    baseFeeBps: 18,
    xLayerTx: 21_804,
    note: 'Pre-kickoff liquidity window is active; early LP boost remains open for this pool.',
    sides: [
      { code: 'BRA', name: 'Brazil', price: 0.57, change: 2.6, liquidity: 294_600, conviction: 64 },
      { code: 'ENG', name: 'England', price: 0.43, change: -1.8, liquidity: 222_300, conviction: 36 },
    ],
    sparkline: [22, 23, 25, 26, 27, 29, 31, 33, 34, 35, 37, 39],
  },
  {
    id: 'esp-ger-semi',
    stage: 'Semifinal room',
    kickoff: '21:00 UTC',
    phase: 'halftime',
    minute: 'HT',
    score: '0 - 0',
    pool: 'ESP/GER-v4',
    status: 'live',
    liquidity: 691_400,
    volume: 2_704_200,
    traders: 9_775,
    hookFeeBps: 34,
    baseFeeBps: 18,
    xLayerTx: 30_112,
    note: 'Halftime spread is stable; second-half fee ladder will unlock on resume.',
    sides: [
      { code: 'ESP', name: 'Spain', price: 0.49, change: 1.1, liquidity: 342_800, conviction: 49 },
      { code: 'GER', name: 'Germany', price: 0.51, change: 0.7, liquidity: 348_600, conviction: 51 },
    ],
    sparkline: [45, 44, 46, 47, 46, 49, 50, 50, 51, 50, 52, 53],
  },
  {
    id: 'usa-mex-group',
    stage: 'Group room',
    kickoff: '02:00 UTC',
    phase: 'settlement',
    minute: 'FT',
    score: '2 - 1',
    pool: 'USA/MEX-v4',
    status: 'settling',
    liquidity: 278_300,
    volume: 938_100,
    traders: 3_982,
    hookFeeBps: 12,
    baseFeeBps: 18,
    xLayerTx: 12_404,
    note: 'Pool is settling. Claim routing is open for winning-side receipts and LP fee shares.',
    sides: [
      { code: 'USA', name: 'United States', price: 0.91, change: 19.4, liquidity: 181_600, conviction: 73 },
      { code: 'MEX', name: 'Mexico', price: 0.09, change: -16.2, liquidity: 96_700, conviction: 27 },
    ],
    sparkline: [18, 19, 20, 22, 25, 31, 42, 55, 61, 76, 85, 91],
  },
]

export const hookSteps: HookStep[] = [
  {
    marker: 'T-24H',
    title: 'Liquidity boot',
    fee: '18 bps',
    incentive: '1.40x LP boost',
    state: 'complete',
  },
  {
    marker: 'T-30M',
    title: 'Pre-match discovery',
    fee: '22 bps',
    incentive: 'Early conviction receipts',
    state: 'complete',
  },
  {
    marker: 'LIVE',
    title: 'Match clock fee',
    fee: '46 bps',
    incentive: 'Volatility routed to LPs',
    state: 'active',
  },
  {
    marker: 'FT',
    title: 'Settlement lane',
    fee: '12 bps',
    incentive: 'Claim and close receipts',
    state: 'pending',
  },
]

export const activityRows: ActivityRow[] = [
  {
    time: '21:24:18',
    kind: 'SWAP',
    market: 'ARG/FRA-v4',
    wallet: '0x8b65...b669',
    amount: '$1,240 USDC',
    fee: '46 bps',
    tx: '0x8b65b669...',
    status: 'confirmed',
  },
  {
    time: '21:23:52',
    kind: 'LP ADD',
    market: 'BRA/ENG-v4',
    wallet: '0xa44d...80fa',
    amount: '$8,800 USDC',
    fee: '22 bps',
    tx: '0xadfccbb5...',
    status: 'confirmed',
  },
  {
    time: '21:22:41',
    kind: 'HOOK',
    market: 'ARG/FRA-v4',
    wallet: 'clock.oracle',
    amount: "minute 63'",
    fee: '46 bps',
    tx: '0x6bcfa7be...',
    status: 'confirmed',
  },
  {
    time: '21:21:07',
    kind: 'CLAIM',
    market: 'USA/MEX-v4',
    wallet: '0xc999...b5df',
    amount: '$312.40',
    fee: '12 bps',
    tx: '0xc999b5df...',
    status: 'pending',
  },
]

export const positions: PositionRow[] = [
  {
    market: 'ARG/FRA-v4',
    side: 'Argentina',
    size: '$620.00',
    entry: '$0.47',
    mark: '$0.52',
    pnl: '+$65.96',
    status: 'open',
  },
  {
    market: 'BRA/ENG-v4',
    side: 'Brazil LP',
    size: '$2,000.00',
    entry: '22 bps',
    mark: '1.40x',
    pnl: '+$18.24',
    status: 'open',
  },
  {
    market: 'USA/MEX-v4',
    side: 'United States',
    size: '$180.00',
    entry: '$0.58',
    mark: '$0.91',
    pnl: '+$102.41',
    status: 'claimable',
  },
]
