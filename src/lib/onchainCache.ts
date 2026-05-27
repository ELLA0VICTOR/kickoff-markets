import { KICKOFF_MARKETS_ADDRESS, X_LAYER_NETWORK } from '../config/contracts'
import type { ActivityRow, MatchMarket } from '../data/markets'
import type { OnchainState } from './contractClient'

type CachedOnchainState = {
  activityRows: ActivityRow[]
  contractAddress: string
  markets: MatchMarket[]
  networkId: string
  savedAt: number
  version: 1
}

const CACHE_VERSION = 1
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function cacheKey() {
  return `kickoff:onchain:${X_LAYER_NETWORK.id}:${KICKOFF_MARKETS_ADDRESS.toLowerCase()}:v${CACHE_VERSION}`
}

export function readCachedOnchainState(): OnchainState | undefined {
  if (typeof window === 'undefined' || !KICKOFF_MARKETS_ADDRESS) return undefined

  try {
    const raw = window.localStorage.getItem(cacheKey())
    if (!raw) return undefined

    const cached = JSON.parse(raw) as CachedOnchainState
    const isCurrent =
      cached.version === CACHE_VERSION &&
      cached.networkId === X_LAYER_NETWORK.id &&
      cached.contractAddress.toLowerCase() === KICKOFF_MARKETS_ADDRESS.toLowerCase() &&
      Date.now() - cached.savedAt <= CACHE_MAX_AGE_MS

    if (!isCurrent || cached.markets.length === 0) return undefined

    return {
      activityRows: cached.activityRows,
      markets: cached.markets,
      positions: [],
    }
  } catch {
    return undefined
  }
}

export function writeCachedOnchainState(state: Pick<OnchainState, 'activityRows' | 'markets'>) {
  if (typeof window === 'undefined' || !KICKOFF_MARKETS_ADDRESS || state.markets.length === 0) return

  try {
    const cached: CachedOnchainState = {
      activityRows: state.activityRows,
      contractAddress: KICKOFF_MARKETS_ADDRESS,
      markets: state.markets,
      networkId: X_LAYER_NETWORK.id,
      savedAt: Date.now(),
      version: CACHE_VERSION,
    }

    window.localStorage.setItem(cacheKey(), JSON.stringify(cached))
  } catch {
    // Storage can be unavailable in private browsing; live RPC state still works.
  }
}
