import type { MatchMarket } from '../data/markets'

export type OracleStatusKind =
  | 'pending'
  | 'watching'
  | 'checking'
  | 'fallback'
  | 'proposed'
  | 'disputed'
  | 'finalized'

export type OracleStatus = {
  kind: OracleStatusKind
  label: string
  detail: string
  fallbackEnabled: boolean
}

const DEFAULT_MATCH_MINUTES = 90
const DEFAULT_GRACE_MINUTES = 30

function kickoffTime(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export function expectedResultTime(market: Pick<MatchMarket, 'kickoff'>) {
  const kickoff = kickoffTime(market.kickoff)
  if (!kickoff) return undefined

  return kickoff + (DEFAULT_MATCH_MINUTES + DEFAULT_GRACE_MINUTES) * 60_000
}

export function getOracleStatus(market: MatchMarket, now = Date.now()): OracleStatus {
  if (market.settlement === 'side-a' || market.settlement === 'side-b' || market.settlement === 'cancelled') {
    return {
      kind: 'finalized',
      label: 'Settlement final',
      detail: 'Claims are open from escrow.',
      fallbackEnabled: false,
    }
  }

  if (market.settlement === 'disputed') {
    return {
      kind: 'disputed',
      label: 'Dispute active',
      detail: 'Resolver review is required before claims open.',
      fallbackEnabled: true,
    }
  }

  if (market.settlement.startsWith('proposed')) {
    return {
      kind: 'proposed',
      label: 'Result proposed',
      detail: 'Optimistic dispute window is open.',
      fallbackEnabled: false,
    }
  }

  const resultTime = expectedResultTime(market)
  if (!resultTime) {
    return {
      kind: 'watching',
      label: 'Oracle watching',
      detail: 'Kickoff time is operator-defined; fallback remains available.',
      fallbackEnabled: false,
    }
  }

  if (now < resultTime) {
    return {
      kind: market.phase === 'live' || market.phase === 'halftime' ? 'watching' : 'pending',
      label: market.phase === 'live' || market.phase === 'halftime' ? 'Oracle watching' : 'Oracle pending',
      detail: 'Result checks begin after the expected full-time window.',
      fallbackEnabled: false,
    }
  }

  const elapsedMinutes = Math.floor((now - resultTime) / 60_000)

  if (elapsedMinutes <= DEFAULT_GRACE_MINUTES) {
    return {
      kind: 'checking',
      label: 'Oracle checking',
      detail: 'The worker should verify final score and propose a result.',
      fallbackEnabled: false,
    }
  }

  return {
    kind: 'fallback',
    label: 'Creator fallback',
    detail: 'No automatic result is visible yet; creator can propose through optimistic settlement.',
    fallbackEnabled: true,
  }
}
