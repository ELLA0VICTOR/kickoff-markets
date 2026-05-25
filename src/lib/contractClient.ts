import {
  COLLATERAL_TOKEN_ADDRESS,
  KICKOFF_MARKETS_ADDRESS,
  X_LAYER_RPC_URLS,
  isCollateralTokenConfigured,
  isKickoffContractConfigured,
} from '../config/contracts'
import type { ActivityRow, FinalMarketSettlement, MarketPhase, MarketSettlement, MatchMarket, PositionRow, RoomDraft } from '../data/markets'
import type { EthereumProvider } from './wallet'

export type ContractActionResult = {
  mode: 'onchain'
  txHash: string
  approvalHash?: string
}

type TransactionRequest = {
  from: string
  to: string
  data: string
  value?: string
}

type RpcLog = {
  address: string
  blockNumber: string
  transactionHash: string
  topics: string[]
  data: string
}

type ContractPosition = {
  sideAShares: bigint
  sideBShares: bigint
  lpShares: bigint
  liquidityProvided: bigint
  feePaid: bigint
  claimed: boolean
  claimedAmount: bigint
  claimableAmount: bigint
}

type ContractRoom = {
  roomId: string
  teamA: string
  teamB: string
  kickoff: string
  score: string
  clock: string
  creator: string
  proposer: string
  phase: MarketPhase
  settlement: MarketSettlement
  proposedOutcome: MarketSettlement
  baseFeeBps: number
  hookFeeBps: number
  reserveA: bigint
  reserveB: bigint
  totalLpShares: bigint
  feePool: bigint
  createdAt: bigint
  disputeDeadline: bigint
  settledAt: bigint
}

export type OnchainState = {
  activityRows: ActivityRow[]
  markets: MatchMarket[]
  positions: PositionRow[]
}

const ROOM_COUNT_SIG = 'roomCount()'
const ROOM_ID_AT_SIG = 'roomIdAt(uint256)'
const GET_ROOM_META_SIG = 'getRoomMeta(bytes32)'
const GET_ROOM_STATE_SIG = 'getRoomState(bytes32)'
const GET_ROOM_TOTALS_SIG = 'getRoomTotals(bytes32)'
const GET_POSITION_SIG = 'getPosition(bytes32,address)'
const QUOTE_CLAIM_SIG = 'quoteClaim(bytes32,address)'
const CREATE_ROOM_SIG = 'createRoom(string,string,string)'
const PLACE_TRADE_SIG = 'placeTrade(bytes32,uint8,uint256)'
const ADD_LIQUIDITY_SIG = 'addLiquidity(bytes32,uint8,uint256)'
const UPDATE_PHASE_SIG = 'updatePhase(bytes32,uint8,string,string,uint16)'
const PROPOSE_SETTLEMENT_SIG = 'proposeSettlement(bytes32,uint8,string,string)'
const DISPUTE_SETTLEMENT_SIG = 'disputeSettlement(bytes32,string)'
const FINALIZE_SETTLEMENT_SIG = 'finalizeSettlement(bytes32)'
const RESOLVE_DISPUTE_SIG = 'resolveDispute(bytes32,uint8,string,string)'
const CLAIM_SIG = 'claim(bytes32)'
const ALLOWANCE_SIG = 'allowance(address,address)'
const APPROVE_SIG = 'approve(address,uint256)'
const BALANCE_OF_SIG = 'balanceOf(address)'
const FAUCET_SIG = 'faucet()'

const EVENT_SIGNATURES = {
  claimed: 'Claimed(bytes32,address,uint256)',
  liquidity: 'LiquidityAdded(bytes32,address,uint256,uint256)',
  phase: 'PhaseUpdated(bytes32,uint8,string,string,uint16)',
  room: 'RoomCreated(bytes32,string,string,string,address)',
  settled: 'RoomSettled(bytes32,uint8,string,string)',
  settlementDisputed: 'SettlementDisputed(bytes32,address,string)',
  settlementProposed: 'SettlementProposed(bytes32,address,uint8,uint256,string,string)',
  trade: 'TradePlaced(bytes32,address,uint8,uint256,uint256,uint256,uint16)',
}

const SELECTORS: Record<string, string> = {
  [ADD_LIQUIDITY_SIG]: '0x1c773f89',
  [ALLOWANCE_SIG]: '0xdd62ed3e',
  [APPROVE_SIG]: '0x095ea7b3',
  [BALANCE_OF_SIG]: '0x70a08231',
  [CLAIM_SIG]: '0xbd66528a',
  [CREATE_ROOM_SIG]: '0x1ea7c445',
  [DISPUTE_SETTLEMENT_SIG]: '0xb82cfebb',
  [FAUCET_SIG]: '0xde5f72fd',
  [FINALIZE_SETTLEMENT_SIG]: '0x19f3b062',
  [GET_POSITION_SIG]: '0x5c388821',
  [GET_ROOM_META_SIG]: '0x0e0c4f72',
  [GET_ROOM_STATE_SIG]: '0x41ac4f6d',
  [GET_ROOM_TOTALS_SIG]: '0xe80de06b',
  [PLACE_TRADE_SIG]: '0xa115ce18',
  [PROPOSE_SETTLEMENT_SIG]: '0xb9669837',
  [QUOTE_CLAIM_SIG]: '0xfe4bb1f9',
  [RESOLVE_DISPUTE_SIG]: '0x6482f984',
  [ROOM_COUNT_SIG]: '0xdf93a4e3',
  [ROOM_ID_AT_SIG]: '0x2d9c15e6',
  [UPDATE_PHASE_SIG]: '0xb6af842b',
}

const EVENT_TOPICS: Record<string, string> = {
  [EVENT_SIGNATURES.claimed]: '0x0508a8b4117d9a7b3d8f5895f6413e61b4f9a2df35afbfb41e78d0ecfff1843f',
  [EVENT_SIGNATURES.liquidity]: '0x47b0d68dd7ea64624970139aa6c676e4e099d12cee4af2dfe393f2353fea86b1',
  [EVENT_SIGNATURES.phase]: '0x9311eb84f307cc70564bd3a5ce86869817ee02996fd9786ee4dd74a706b2e993',
  [EVENT_SIGNATURES.room]: '0xca00d9b3949673c33d73e70a45cfe412ce26b358a9a288fc5ebde67c9838b5c5',
  [EVENT_SIGNATURES.settled]: '0x81c71618da198d131a5b55e16329ff0c9d6f2865e4b39780ba0a615c5fd42c49',
  [EVENT_SIGNATURES.settlementDisputed]: '0xfaf378cd9c8872e7bc3d17220cb0c51ac3c884eafc1cbe32398629b955b92c97',
  [EVENT_SIGNATURES.settlementProposed]: '0xada32f8a9c6192701eb5f00a8f25828a6bd58dd5aa0229d680334c3eb8ee8626',
  [EVENT_SIGNATURES.trade]: '0x538f4ceb3fa05614310d763da21dc58461ae4e926c21439f18747f89d79856b0',
}

const TOKEN_DECIMALS = 6n
const TOKEN_SCALE = 10n ** TOKEN_DECIMALS
const LOG_BLOCK_CHUNK = 100n
const LOG_LOOKBACK_BLOCKS = 1_000n
type AbiValue =
  | {
      kind: 'address' | 'bytes32' | 'string'
      value: string
    }
  | {
      kind: 'uint'
      value: bigint | number
    }

function stripHex(value: string) {
  return value.startsWith('0x') ? value.slice(2) : value
}

function ensure0x(value: string) {
  return value.startsWith('0x') ? value : `0x${value}`
}

function padWord(value: string) {
  return stripHex(value).padStart(64, '0')
}

function textToHex(value: string) {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function hexToText(value: string) {
  const clean = stripHex(value)
  const bytes = clean.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []
  return new TextDecoder().decode(new Uint8Array(bytes))
}

function bytesToWord(hex: string) {
  const clean = stripHex(hex).slice(0, 64)
  return clean.padEnd(64, '0')
}

function encodeUint(value: bigint | number) {
  return padWord(BigInt(value).toString(16))
}

function encodeAddress(value: string) {
  return padWord(stripHex(value).toLowerCase())
}

function encodeString(value: string) {
  const bytes = textToHex(value)
  const paddedLength = Math.ceil(bytes.length / 64) * 64
  return encodeUint(bytes.length / 2) + bytes.padEnd(paddedLength, '0')
}

function encodeArgs(args: AbiValue[]) {
  const headWords: string[] = []
  const tailWords: string[] = []
  let offset = BigInt(args.length * 32)

  for (const arg of args) {
    if (arg.kind === 'string') {
      const encoded = encodeString(arg.value)
      headWords.push(encodeUint(offset))
      tailWords.push(encoded)
      offset += BigInt(encoded.length / 2)
      continue
    }

    if (arg.kind === 'address') {
      headWords.push(encodeAddress(arg.value))
      continue
    }

    if (arg.kind === 'bytes32') {
      headWords.push(bytesToWord(arg.value))
      continue
    }

    if (arg.kind === 'uint') {
      headWords.push(encodeUint(arg.value))
    }
  }

  return headWords.join('') + tailWords.join('')
}

function wordAt(data: string, index: number) {
  const clean = stripHex(data)
  return clean.slice(index * 64, index * 64 + 64).padStart(64, '0')
}

function readUint(data: string, index: number) {
  return BigInt(`0x${wordAt(data, index)}`)
}

function readBool(data: string, index: number) {
  return readUint(data, index) !== 0n
}

function readAddress(data: string, index: number) {
  return `0x${wordAt(data, index).slice(24)}`
}

function readString(data: string, index: number) {
  const clean = stripHex(data)
  const offset = Number(readUint(data, index))
  const length = Number(BigInt(`0x${clean.slice(offset * 2, offset * 2 + 64) || '0'}`))
  const start = offset * 2 + 64
  return hexToText(clean.slice(start, start + length * 2))
}

function topicToAddress(topic?: string) {
  return topic ? `0x${stripHex(topic).slice(24)}` : ''
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function toHexQuantity(value: bigint | number) {
  return `0x${BigInt(value).toString(16)}`
}

function tokenUnitsToNumber(value: bigint) {
  return Number(value) / Number(TOKEN_SCALE)
}

function formatToken(value: bigint) {
  const whole = value / TOKEN_SCALE
  const decimal = value % TOKEN_SCALE
  if (decimal === 0n) return whole.toString()

  const decimalText = decimal.toString().padStart(Number(TOKEN_DECIMALS), '0').replace(/0+$/, '')
  return `${whole}.${decimalText}`
}

function cleanTeamCode(name: string) {
  return name
    .trim()
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 3)
    .toUpperCase() || 'TBD'
}

function phaseFromContract(value: bigint): MarketPhase {
  if (value === 1n) return 'live'
  if (value === 2n) return 'halftime'
  if (value === 3n) return 'settlement'
  return 'pre-match'
}

function settlementFromContract(value: bigint): MarketSettlement {
  if (value === 1n) return 'proposed-cancel'
  if (value === 2n) return 'proposed-a'
  if (value === 3n) return 'proposed-b'
  if (value === 4n) return 'disputed'
  if (value === 5n) return 'cancelled'
  if (value === 6n) return 'side-a'
  if (value === 7n) return 'side-b'
  return 'open'
}

function finalSettlementToContract(value: FinalMarketSettlement) {
  if (value === 'cancelled') return 1
  if (value === 'side-a') return 2
  if (value === 'side-b') return 3
  return 0
}

function phaseToContract(value: MarketPhase) {
  if (value === 'live') return 1
  if (value === 'halftime') return 2
  if (value === 'settlement') return 3
  return 0
}

function marketStatus(phase: MarketPhase, settlement: MarketSettlement): MatchMarket['status'] {
  if (settlement !== 'open' || phase === 'settlement') return 'settling'
  if (phase === 'live' || phase === 'halftime') return 'live'
  return 'open'
}

function marketStage(phase: MarketPhase, settlement: MarketSettlement) {
  if (settlement === 'proposed-a' || settlement === 'proposed-b' || settlement === 'proposed-cancel') return 'Proposed room'
  if (settlement === 'disputed') return 'Disputed room'
  if (settlement === 'side-a' || settlement === 'side-b') return 'Settled room'
  if (settlement === 'cancelled') return 'Cancelled room'
  if (phase === 'live') return 'Live room'
  if (phase === 'halftime') return 'Halftime room'
  return 'Pre-match room'
}

function marketNote(room: ContractRoom) {
  if (room.settlement === 'proposed-a') return `${room.teamA} proposed as winner. Dispute window is open.`
  if (room.settlement === 'proposed-b') return `${room.teamB} proposed as winner. Dispute window is open.`
  if (room.settlement === 'proposed-cancel') return 'Cancellation proposed. Dispute window is open.'
  if (room.settlement === 'disputed') return 'Settlement disputed. Creator or oracle agent must resolve the room.'
  if (room.settlement === 'side-a') return `${room.teamA} settled as winner. Claims are open against escrowed collateral.`
  if (room.settlement === 'side-b') return `${room.teamB} settled as winner. Claims are open against escrowed collateral.`
  if (room.settlement === 'cancelled') return 'Room cancelled. Traders and LPs can reclaim escrowed collateral.'
  if (room.phase === 'live') return 'Live Match Clock fee is active; trade fees are accumulating for LP claim rewards.'
  if (room.phase === 'halftime') return 'Halftime fee state is active while the match clock is paused.'
  return 'Pre-match room is open for collateral-backed trades and liquidity.'
}

function sparklineFromRoom(room: ContractRoom) {
  const totalReserve = room.reserveA + room.reserveB
  const aConviction = totalReserve > 0n ? Math.round((Number(room.reserveB) / Number(totalReserve)) * 100) : 50
  return [50, 50, Math.max(5, aConviction - 6), Math.max(5, aConviction - 2), aConviction, Math.min(95, aConviction + 3)]
}

export function parseTokenAmount(value: string) {
  const normalized = value.trim().replaceAll(',', '')
  if (!/^\d+(\.\d{0,6})?$/.test(normalized)) {
    throw new Error('Enter a valid USDC amount with up to 6 decimals.')
  }

  const [whole, decimal = ''] = normalized.split('.')
  return BigInt(whole) * TOKEN_SCALE + BigInt((decimal + '000000').slice(0, 6))
}

async function rpcRequest<T>(method: string, params: unknown[] = []): Promise<T> {
  const errors: string[] = []

  for (const rpcUrl of X_LAYER_RPC_URLS) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: Date.now(),
          jsonrpc: '2.0',
          method,
          params,
        }),
      })
      const payload = (await response.json()) as { error?: { message?: string }; result?: T }

      if (payload.error) {
        throw new Error(payload.error.message || `${method} failed`)
      }

      return payload.result as T
    } catch (error) {
      errors.push(`${rpcUrl}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  throw new Error(`${method} failed across ${X_LAYER_RPC_URLS.length} RPC endpoint(s): ${errors.join(' | ')}`)
}

async function selector(signature: string) {
  const value = SELECTORS[signature]
  if (!value) throw new Error(`Missing selector for ${signature}.`)
  return value
}

async function eventTopic(signature: string) {
  const value = EVENT_TOPICS[signature]
  if (!value) throw new Error(`Missing event topic for ${signature}.`)
  return value
}

async function encodeCall(signature: string, args: AbiValue[] = []) {
  return (await selector(signature)) + encodeArgs(args)
}

async function callContract(to: string, data: string) {
  return rpcRequest<string>('eth_call', [{ to, data }, 'latest'])
}

async function readLatestBlockNumber() {
  const blockNumber = await rpcRequest<string>('eth_blockNumber')
  return BigInt(blockNumber)
}

async function sendTransaction(provider: EthereumProvider, from: string, to: string, data: string) {
  return provider.request<string>({
    method: 'eth_sendTransaction',
    params: [{ from, to, data, value: '0x0' } satisfies TransactionRequest],
  })
}

async function waitForTransaction(txHash: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const receipt = await rpcRequest<{ status?: string } | null>('eth_getTransactionReceipt', [txHash])
    if (receipt) {
      if (receipt.status && receipt.status !== '0x1') {
        throw new Error('Transaction reverted on-chain.')
      }
      return receipt
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1500))
  }

  throw new Error('Transaction was submitted but not confirmed yet.')
}

function requireKickoffAddress() {
  if (!isKickoffContractConfigured()) {
    throw new Error('Deploy KickoffMarkets and set VITE_KICKOFF_MARKETS_ADDRESS first.')
  }
}

function requireCollateralAddress() {
  if (!isCollateralTokenConfigured()) {
    throw new Error('Deploy or configure an ERC20 collateral token in VITE_COLLATERAL_TOKEN_ADDRESS first.')
  }
}

async function readRoomCount() {
  requireKickoffAddress()
  const data = await encodeCall(ROOM_COUNT_SIG)
  const result = await callContract(KICKOFF_MARKETS_ADDRESS, data)
  return Number(readUint(result, 0))
}

async function readRoomIdAt(index: number) {
  const data = await encodeCall(ROOM_ID_AT_SIG, [{ kind: 'uint', value: index }])
  const result = await callContract(KICKOFF_MARKETS_ADDRESS, data)
  return ensure0x(wordAt(result, 0))
}

async function readRoom(roomId: string): Promise<ContractRoom> {
  const [metaResult, stateResult, totalsResult] = await Promise.all([
    encodeCall(GET_ROOM_META_SIG, [{ kind: 'bytes32', value: roomId }]).then((data) => callContract(KICKOFF_MARKETS_ADDRESS, data)),
    encodeCall(GET_ROOM_STATE_SIG, [{ kind: 'bytes32', value: roomId }]).then((data) => callContract(KICKOFF_MARKETS_ADDRESS, data)),
    encodeCall(GET_ROOM_TOTALS_SIG, [{ kind: 'bytes32', value: roomId }]).then((data) => callContract(KICKOFF_MARKETS_ADDRESS, data)),
  ])

  return {
    roomId,
    teamA: readString(metaResult, 0),
    teamB: readString(metaResult, 1),
    kickoff: readString(metaResult, 2),
    creator: readAddress(metaResult, 3),
    createdAt: readUint(metaResult, 4),
    score: readString(stateResult, 0),
    clock: readString(stateResult, 1),
    phase: phaseFromContract(readUint(stateResult, 2)),
    settlement: settlementFromContract(readUint(stateResult, 3)),
    baseFeeBps: Number(readUint(stateResult, 4)),
    hookFeeBps: Number(readUint(stateResult, 5)),
    settledAt: readUint(stateResult, 6),
    proposedOutcome: settlementFromContract(readUint(stateResult, 7)),
    disputeDeadline: readUint(stateResult, 8),
    proposer: readAddress(stateResult, 9),
    reserveA: readUint(totalsResult, 0),
    reserveB: readUint(totalsResult, 1),
    totalLpShares: readUint(totalsResult, 2),
    feePool: readUint(totalsResult, 3),
  }
}

async function readPosition(roomId: string, walletAddress?: string): Promise<ContractPosition | undefined> {
  if (!walletAddress) return undefined

  const positionData = await encodeCall(GET_POSITION_SIG, [
    { kind: 'bytes32', value: roomId },
    { kind: 'address', value: walletAddress },
  ])
  const positionResult = await callContract(KICKOFF_MARKETS_ADDRESS, positionData)

  const quoteData = await encodeCall(QUOTE_CLAIM_SIG, [
    { kind: 'bytes32', value: roomId },
    { kind: 'address', value: walletAddress },
  ])
  const quoteResult = await callContract(KICKOFF_MARKETS_ADDRESS, quoteData)

  return {
    sideAShares: readUint(positionResult, 0),
    sideBShares: readUint(positionResult, 1),
    lpShares: readUint(positionResult, 2),
    liquidityProvided: readUint(positionResult, 3),
    feePaid: readUint(positionResult, 4),
    claimed: readBool(positionResult, 5),
    claimedAmount: readUint(positionResult, 6),
    claimableAmount: readUint(quoteResult, 0),
  }
}

function roomToMarket(room: ContractRoom, txCount: number, traderCount: number, position?: ContractPosition): MatchMarket {
  const totalReserve = room.reserveA + room.reserveB
  const sideAPrice = totalReserve > 0n ? Number(room.reserveB) / Number(totalReserve) : 0.5
  const sideBPrice = 1 - sideAPrice
  const totalVolume = room.reserveA + room.reserveB + room.feePool
  const sideAConviction = Math.round(sideAPrice * 100)

  return {
    id: room.roomId,
    roomId: room.roomId,
    stage: marketStage(room.phase, room.settlement),
    kickoff: room.kickoff,
    phase: room.phase,
    settlement: room.settlement,
    minute: room.clock,
    score: room.score,
    pool: `${cleanTeamCode(room.teamA)}/${cleanTeamCode(room.teamB)}`,
    creator: room.creator,
    proposer: room.proposer,
    status: marketStatus(room.phase, room.settlement),
    liquidity: tokenUnitsToNumber(room.totalLpShares),
    volume: tokenUnitsToNumber(totalVolume),
    traders: traderCount,
    hookFeeBps: room.hookFeeBps,
    baseFeeBps: room.baseFeeBps,
    feePool: tokenUnitsToNumber(room.feePool),
    claimableAmount: tokenUnitsToNumber(position?.claimableAmount ?? 0n),
    disputeDeadline: Number(room.disputeDeadline),
    proposedOutcome: room.proposedOutcome,
    xLayerTx: txCount,
    note: marketNote(room),
    sides: [
      {
        code: cleanTeamCode(room.teamA),
        name: room.teamA,
        price: sideAPrice,
        change: 0,
        liquidity: tokenUnitsToNumber(room.reserveA),
        conviction: sideAConviction,
      },
      {
        code: cleanTeamCode(room.teamB),
        name: room.teamB,
        price: sideBPrice,
        change: 0,
        liquidity: tokenUnitsToNumber(room.reserveB),
        conviction: 100 - sideAConviction,
      },
    ],
    sparkline: sparklineFromRoom(room),
  }
}

function positionRowsFor(room: ContractRoom, market: MatchMarket, position?: ContractPosition): PositionRow[] {
  if (!position) return []

  const rows: PositionRow[] = []
  const status = market.settlement === 'open' || position.claimableAmount === 0n ? 'open' : 'claimable'

  if (position.sideAShares > 0n) {
    rows.push({
      market: market.pool,
      side: room.teamA,
      size: `${formatToken(position.sideAShares)} shares`,
      entry: `$${market.sides[0].price.toFixed(2)}`,
      mark: market.settlement,
      pnl: `$${formatToken(position.claimableAmount)}`,
      status,
    })
  }

  if (position.sideBShares > 0n) {
    rows.push({
      market: market.pool,
      side: room.teamB,
      size: `${formatToken(position.sideBShares)} shares`,
      entry: `$${market.sides[1].price.toFixed(2)}`,
      mark: market.settlement,
      pnl: `$${formatToken(position.claimableAmount)}`,
      status,
    })
  }

  if (position.lpShares > 0n) {
    rows.push({
      market: market.pool,
      side: 'LP position',
      size: `$${formatToken(position.liquidityProvided)}`,
      entry: `${market.hookFeeBps} bps`,
      mark: market.settlement === 'open' ? 'active' : 'claimable',
      pnl: `$${formatToken(position.claimableAmount)}`,
      status,
    })
  }

  return rows
}

async function loadActivityLogs(roomLabels: Map<string, string>) {
  const topics = {
    claimed: await eventTopic(EVENT_SIGNATURES.claimed),
    liquidity: await eventTopic(EVENT_SIGNATURES.liquidity),
    phase: await eventTopic(EVENT_SIGNATURES.phase),
    room: await eventTopic(EVENT_SIGNATURES.room),
    settled: await eventTopic(EVENT_SIGNATURES.settled),
    settlementDisputed: await eventTopic(EVENT_SIGNATURES.settlementDisputed),
    settlementProposed: await eventTopic(EVENT_SIGNATURES.settlementProposed),
    trade: await eventTopic(EVENT_SIGNATURES.trade),
  }
  const latestBlock = await readLatestBlockNumber()
  const logs: RpcLog[] = []
  const fromStart = latestBlock > LOG_LOOKBACK_BLOCKS ? latestBlock - LOG_LOOKBACK_BLOCKS : 0n

  for (let fromBlock = fromStart; fromBlock <= latestBlock; fromBlock += LOG_BLOCK_CHUNK) {
    const toBlock = fromBlock + LOG_BLOCK_CHUNK - 1n > latestBlock ? latestBlock : fromBlock + LOG_BLOCK_CHUNK - 1n
    const chunkLogs = await rpcRequest<RpcLog[]>('eth_getLogs', [
      {
        address: KICKOFF_MARKETS_ADDRESS,
        fromBlock: toHexQuantity(fromBlock),
        toBlock: toHexQuantity(toBlock),
      },
    ])
    logs.push(...chunkLogs)
  }

  const activityRows: ActivityRow[] = []
  const txCountByRoom = new Map<string, number>()
  const tradersByRoom = new Map<string, Set<string>>()

  for (const log of logs) {
    const topic = log.topics[0]?.toLowerCase()
    const roomId = log.topics[1] ? ensure0x(wordAt(log.topics[1], 0)) : ''
    const market = roomLabels.get(roomId) ?? `${roomId.slice(0, 10)}...`
    const time = `#${Number.parseInt(log.blockNumber, 16).toString()}`
    const tx = `${log.transactionHash.slice(0, 10)}...`

    if (roomId) {
      txCountByRoom.set(roomId, (txCountByRoom.get(roomId) ?? 0) + 1)
    }

    if (topic === topics.room) {
      const creator = topicToAddress(log.topics[2])
      activityRows.unshift({
        time,
        kind: 'ROOM',
        market,
        wallet: shortAddress(creator),
        amount: 'created',
        fee: '-',
        tx,
        status: 'confirmed',
      })
      continue
    }

    if (topic === topics.trade) {
      const trader = topicToAddress(log.topics[2])
      const grossAmount = readUint(log.data, 1)
      const feeBps = readUint(log.data, 4)
      if (roomId && trader) {
        const traders = tradersByRoom.get(roomId) ?? new Set<string>()
        traders.add(trader.toLowerCase())
        tradersByRoom.set(roomId, traders)
      }
      activityRows.unshift({
        time,
        kind: 'TRADE',
        market,
        wallet: shortAddress(trader),
        amount: `$${formatToken(grossAmount)}`,
        fee: `${feeBps.toString()} bps`,
        tx,
        status: 'confirmed',
      })
      continue
    }

    if (topic === topics.liquidity) {
      const provider = topicToAddress(log.topics[2])
      const amount = readUint(log.data, 0)
      if (roomId && provider) {
        const traders = tradersByRoom.get(roomId) ?? new Set<string>()
        traders.add(provider.toLowerCase())
        tradersByRoom.set(roomId, traders)
      }
      activityRows.unshift({
        time,
        kind: 'LP ADD',
        market,
        wallet: shortAddress(provider),
        amount: `$${formatToken(amount)}`,
        fee: '-',
        tx,
        status: 'confirmed',
      })
      continue
    }

    if (topic === topics.settled) {
      const outcome = settlementFromContract(readUint(log.data, 0))
      activityRows.unshift({
        time,
        kind: 'SETTLE',
        market,
        wallet: 'creator',
        amount: outcome,
        fee: '12 bps',
        tx,
        status: 'confirmed',
      })
      continue
    }

    if (topic === topics.settlementProposed) {
      const proposer = topicToAddress(log.topics[2])
      const outcome = settlementFromContract(readUint(log.data, 0))
      activityRows.unshift({
        time,
        kind: 'PROPOSE',
        market,
        wallet: shortAddress(proposer),
        amount: outcome,
        fee: 'window',
        tx,
        status: 'confirmed',
      })
      continue
    }

    if (topic === topics.settlementDisputed) {
      const disputer = topicToAddress(log.topics[2])
      activityRows.unshift({
        time,
        kind: 'DISPUTE',
        market,
        wallet: shortAddress(disputer),
        amount: 'opened',
        fee: '-',
        tx,
        status: 'confirmed',
      })
      continue
    }

    if (topic === topics.claimed) {
      const trader = topicToAddress(log.topics[2])
      const payout = readUint(log.data, 0)
      activityRows.unshift({
        time,
        kind: 'CLAIM',
        market,
        wallet: shortAddress(trader),
        amount: `$${formatToken(payout)}`,
        fee: '-',
        tx,
        status: 'confirmed',
      })
      continue
    }

    if (topic === topics.phase) {
      activityRows.unshift({
        time,
        kind: 'CLOCK',
        market,
        wallet: 'creator',
        amount: 'updated',
        fee: `${readUint(log.data, 3).toString()} bps`,
        tx,
        status: 'confirmed',
      })
    }
  }

  return { activityRows, tradersByRoom, txCountByRoom }
}

export async function loadOnchainState(walletAddress?: string): Promise<OnchainState> {
  if (!isKickoffContractConfigured()) {
    return { activityRows: [], markets: [], positions: [] }
  }

  const count = await readRoomCount()
  const roomIds = await Promise.all(Array.from({ length: count }, (_, index) => readRoomIdAt(index)))
  const rooms = await Promise.all(roomIds.map((roomId) => readRoom(roomId)))
  const roomLabels = new Map(rooms.map((room) => [room.roomId, `${cleanTeamCode(room.teamA)}/${cleanTeamCode(room.teamB)}`]))
  let activityRows: ActivityRow[] = []
  let tradersByRoom = new Map<string, Set<string>>()
  let txCountByRoom = new Map<string, number>()

  try {
    const activity = await loadActivityLogs(roomLabels)
    activityRows = activity.activityRows
    tradersByRoom = activity.tradersByRoom
    txCountByRoom = activity.txCountByRoom
  } catch {
    // Markets should still render if a public RPC throttles log history.
  }

  const positions = await Promise.all(rooms.map((room) => readPosition(room.roomId, walletAddress)))
  const markets = rooms.map((room, index) =>
    roomToMarket(room, txCountByRoom.get(room.roomId) ?? 0, tradersByRoom.get(room.roomId)?.size ?? 0, positions[index]),
  )
  const positionRows = rooms.flatMap((room, index) => positionRowsFor(room, markets[index], positions[index]))

  return {
    activityRows,
    markets: markets.reverse(),
    positions: positionRows,
  }
}

export async function readCollateralBalance(address: string) {
  requireCollateralAddress()
  const data = await encodeCall(BALANCE_OF_SIG, [{ kind: 'address', value: address }])
  const result = await callContract(COLLATERAL_TOKEN_ADDRESS, data)
  return tokenUnitsToNumber(readUint(result, 0))
}

async function readAllowance(owner: string) {
  requireCollateralAddress()
  requireKickoffAddress()
  const data = await encodeCall(ALLOWANCE_SIG, [
    { kind: 'address', value: owner },
    { kind: 'address', value: KICKOFF_MARKETS_ADDRESS },
  ])
  const result = await callContract(COLLATERAL_TOKEN_ADDRESS, data)
  return readUint(result, 0)
}

async function approveIfNeeded(provider: EthereumProvider, from: string, amount: bigint) {
  requireCollateralAddress()
  const currentAllowance = await readAllowance(from)
  if (currentAllowance >= amount) return undefined

  const data = await encodeCall(APPROVE_SIG, [
    { kind: 'address', value: KICKOFF_MARKETS_ADDRESS },
    { kind: 'uint', value: amount },
  ])
  const txHash = await sendTransaction(provider, from, COLLATERAL_TOKEN_ADDRESS, data)
  await waitForTransaction(txHash)
  return txHash
}

export async function faucetCollateralTx(provider: EthereumProvider, from: string): Promise<ContractActionResult> {
  requireCollateralAddress()
  const data = await encodeCall(FAUCET_SIG)
  const txHash = await sendTransaction(provider, from, COLLATERAL_TOKEN_ADDRESS, data)
  await waitForTransaction(txHash)
  return { mode: 'onchain', txHash }
}

export async function createRoomTx(provider: EthereumProvider, from: string, draft: RoomDraft): Promise<ContractActionResult> {
  requireKickoffAddress()
  const data = await encodeCall(CREATE_ROOM_SIG, [
    { kind: 'string', value: draft.teamA },
    { kind: 'string', value: draft.teamB },
    { kind: 'string', value: draft.kickoff },
  ])
  const txHash = await sendTransaction(provider, from, KICKOFF_MARKETS_ADDRESS, data)
  await waitForTransaction(txHash)
  return { mode: 'onchain', txHash }
}

export async function placeTradeTx(
  provider: EthereumProvider,
  from: string,
  market: MatchMarket,
  sideIndex: number,
  amount: string,
): Promise<ContractActionResult> {
  requireKickoffAddress()
  const parsedAmount = parseTokenAmount(amount)
  const approvalHash = await approveIfNeeded(provider, from, parsedAmount)
  const data = await encodeCall(PLACE_TRADE_SIG, [
    { kind: 'bytes32', value: market.roomId },
    { kind: 'uint', value: sideIndex },
    { kind: 'uint', value: parsedAmount },
  ])
  const txHash = await sendTransaction(provider, from, KICKOFF_MARKETS_ADDRESS, data)
  await waitForTransaction(txHash)
  return { mode: 'onchain', txHash, approvalHash }
}

export async function addLiquidityTx(
  provider: EthereumProvider,
  from: string,
  market: MatchMarket,
  sideIndex: number,
  amount: string,
): Promise<ContractActionResult> {
  requireKickoffAddress()
  const parsedAmount = parseTokenAmount(amount)
  const approvalHash = await approveIfNeeded(provider, from, parsedAmount)
  const data = await encodeCall(ADD_LIQUIDITY_SIG, [
    { kind: 'bytes32', value: market.roomId },
    { kind: 'uint', value: sideIndex },
    { kind: 'uint', value: parsedAmount },
  ])
  const txHash = await sendTransaction(provider, from, KICKOFF_MARKETS_ADDRESS, data)
  await waitForTransaction(txHash)
  return { mode: 'onchain', txHash, approvalHash }
}

export async function updatePhaseTx(
  provider: EthereumProvider,
  from: string,
  market: MatchMarket,
  phase: MarketPhase,
  clock: string,
  score: string,
  feeBps: number,
): Promise<ContractActionResult> {
  requireKickoffAddress()
  const data = await encodeCall(UPDATE_PHASE_SIG, [
    { kind: 'bytes32', value: market.roomId },
    { kind: 'uint', value: phaseToContract(phase) },
    { kind: 'string', value: clock },
    { kind: 'string', value: score },
    { kind: 'uint', value: feeBps },
  ])
  const txHash = await sendTransaction(provider, from, KICKOFF_MARKETS_ADDRESS, data)
  await waitForTransaction(txHash)
  return { mode: 'onchain', txHash }
}

export async function proposeSettlementTx(
  provider: EthereumProvider,
  from: string,
  market: MatchMarket,
  outcome: FinalMarketSettlement,
  score: string,
  clock: string,
): Promise<ContractActionResult> {
  requireKickoffAddress()
  const data = await encodeCall(PROPOSE_SETTLEMENT_SIG, [
    { kind: 'bytes32', value: market.roomId },
    { kind: 'uint', value: finalSettlementToContract(outcome) },
    { kind: 'string', value: score },
    { kind: 'string', value: clock },
  ])
  const txHash = await sendTransaction(provider, from, KICKOFF_MARKETS_ADDRESS, data)
  await waitForTransaction(txHash)
  return { mode: 'onchain', txHash }
}

export async function disputeSettlementTx(
  provider: EthereumProvider,
  from: string,
  market: MatchMarket,
  reason: string,
): Promise<ContractActionResult> {
  requireKickoffAddress()
  const data = await encodeCall(DISPUTE_SETTLEMENT_SIG, [
    { kind: 'bytes32', value: market.roomId },
    { kind: 'string', value: reason },
  ])
  const txHash = await sendTransaction(provider, from, KICKOFF_MARKETS_ADDRESS, data)
  await waitForTransaction(txHash)
  return { mode: 'onchain', txHash }
}

export async function finalizeSettlementTx(provider: EthereumProvider, from: string, market: MatchMarket): Promise<ContractActionResult> {
  requireKickoffAddress()
  const data = await encodeCall(FINALIZE_SETTLEMENT_SIG, [{ kind: 'bytes32', value: market.roomId }])
  const txHash = await sendTransaction(provider, from, KICKOFF_MARKETS_ADDRESS, data)
  await waitForTransaction(txHash)
  return { mode: 'onchain', txHash }
}

export async function resolveDisputeTx(
  provider: EthereumProvider,
  from: string,
  market: MatchMarket,
  outcome: FinalMarketSettlement,
  score: string,
  clock: string,
): Promise<ContractActionResult> {
  requireKickoffAddress()
  const data = await encodeCall(RESOLVE_DISPUTE_SIG, [
    { kind: 'bytes32', value: market.roomId },
    { kind: 'uint', value: finalSettlementToContract(outcome) },
    { kind: 'string', value: score },
    { kind: 'string', value: clock },
  ])
  const txHash = await sendTransaction(provider, from, KICKOFF_MARKETS_ADDRESS, data)
  await waitForTransaction(txHash)
  return { mode: 'onchain', txHash }
}

export async function claimTx(provider: EthereumProvider, from: string, market: MatchMarket): Promise<ContractActionResult> {
  requireKickoffAddress()
  const data = await encodeCall(CLAIM_SIG, [{ kind: 'bytes32', value: market.roomId }])
  const txHash = await sendTransaction(provider, from, KICKOFF_MARKETS_ADDRESS, data)
  await waitForTransaction(txHash)
  return { mode: 'onchain', txHash }
}

export { formatToken, tokenUnitsToNumber, toHexQuantity }
