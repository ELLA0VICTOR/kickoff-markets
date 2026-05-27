#!/usr/bin/env node
import dns from 'node:dns'
import fs from 'node:fs'
import nodeHttp from 'node:http'
import path from 'node:path'
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  http as viemHttp,
  parseAbi,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

dns.setDefaultResultOrder('ipv4first')

const NETWORKS = {
  mainnet: {
    id: 196,
    name: 'X Layer Mainnet',
    rpcUrls: ['https://rpc.xlayer.tech', 'https://xlayerrpc.okx.com'],
  },
  testnet: {
    id: 1952,
    name: 'X Layer Testnet',
    rpcUrls: ['https://testrpc.xlayer.tech', 'https://testrpc.xlayer.tech/terigon', 'https://xlayertestrpc.okx.com/terigon'],
  },
}

const MARKET_ABI = parseAbi([
  'function createRoom(string teamA,string teamB,string kickoff) returns (bytes32)',
  'function finalizeSettlement(bytes32 roomId)',
  'function updatePhase(bytes32 roomId,uint8 phase,string clock,string score,uint16 suggestedFeeBps)',
])

const ORACLE_AGENT_ABI = parseAbi([
  'function resolveResult(bytes32 roomId,uint8 outcome,string score,string clock)',
  'function submitClock(bytes32 roomId,uint8 phase,string clock,string score,uint16 suggestedFeeBps)',
  'function submitResult(bytes32 roomId,uint8 outcome,string score,string clock)',
])

const SIGNATURES = {
  roomCount: 'roomCount()',
  roomIdAt: 'roomIdAt(uint256)',
  getRoomMeta: 'getRoomMeta(bytes32)',
  getRoomState: 'getRoomState(bytes32)',
}

const SELECTORS = {
  [SIGNATURES.roomCount]: '0xdf93a4e3',
  [SIGNATURES.roomIdAt]: '0x2d9c15e6',
  [SIGNATURES.getRoomMeta]: '0x0e0c4f72',
  [SIGNATURES.getRoomState]: '0x41ac4f6d',
}

const SETTLEMENT = {
  0: 'open',
  1: 'proposed-cancel',
  2: 'proposed-a',
  3: 'proposed-b',
  4: 'disputed',
  5: 'cancelled',
  6: 'side-a',
  7: 'side-b',
}

const PHASE = {
  0: 'pre-match',
  1: 'live',
  2: 'halftime',
  3: 'settlement',
}

const PHASE_CODE = {
  'pre-match': 0,
  live: 1,
  halftime: 2,
  settlement: 3,
}

const OUTCOME = {
  cancel: 1,
  sideA: 2,
  sideB: 3,
}

const FINAL_STATUSES = new Set(['FINISHED', 'AWARDED'])
const CANCELLED_STATUSES = new Set(['CANCELLED', 'CANCELED', 'ABANDONED'])
const POSTPONED_STATUSES = new Set(['POSTPONED', 'SUSPENDED'])
const LIVE_STATUSES = new Set(['IN_PLAY', 'LIVE'])
const HALFTIME_STATUSES = new Set(['PAUSED'])

const args = new Set(process.argv.slice(2))
const jsonMode = args.has('--json')
const dryRun = args.has('--dry-run') || args.has('--dry')
const probeMode = args.has('--probe-football-data') || args.has('--probe')
const importMode = args.has('--import-fixtures') || args.has('--import')
const watchMode = args.has('--watch')
const root = process.cwd()
const env = loadEnv(root)
const networkId = env.VITE_X_LAYER_NETWORK?.trim().toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet'
const network = NETWORKS[networkId]
const rpcUrls = Array.from(new Set([env.X_LAYER_RPC_URL?.trim(), env.VITE_X_LAYER_RPC_URL?.trim(), ...network.rpcUrls].filter(Boolean)))
const marketsAddress = env.VITE_KICKOFF_MARKETS_ADDRESS?.trim()
const oracleAgentAddress = env.VITE_MATCH_ORACLE_AGENT_ADDRESS?.trim()
const providerName = env.ORACLE_PROVIDER?.trim().toLowerCase() || 'manual'
const resultGraceMinutes = Number(env.ORACLE_RESULT_GRACE_MINUTES || 30)
const matchMinutes = Number(env.ORACLE_MATCH_MINUTES || 90)
const pollSeconds = Math.max(10, Number(readArg('--poll-seconds') || env.ORACLE_POLL_SECONDS || 60))
const healthPort = Number(readArg('--health-port') || env.ORACLE_HEALTH_PORT || env.PORT || 0)
const maxRuns = Number(readArg('--max-runs') || env.ORACLE_MAX_RUNS || 0)
const probeCompetition = readArg('--competition') || env.ORACLE_PROBE_COMPETITION || 'WC'
const probeDateFrom = readArg('--date-from') || env.ORACLE_PROBE_DATE_FROM || '2026-06-11'
const probeDateTo = readArg('--date-to') || env.ORACLE_PROBE_DATE_TO || '2026-06-18'
const probeStatus = readArg('--status') || env.ORACLE_PROBE_STATUS || ''
const importCompetition = readArg('--competition') || env.ORACLE_IMPORT_COMPETITION || env.ORACLE_FOOTBALL_DATA_COMPETITION || 'WC'
const importDateFrom = readArg('--date-from') || env.ORACLE_IMPORT_DATE_FROM || probeDateFrom
const importDateTo = readArg('--date-to') || env.ORACLE_IMPORT_DATE_TO || probeDateTo
const importStatus = readArg('--status') || env.ORACLE_IMPORT_STATUS || ''
const importLimit = Math.max(1, Number(readArg('--limit') || env.ORACLE_IMPORT_LIMIT || 32))
const clockAutomation = readBoolean(env.ORACLE_CLOCK_AUTOMATION, true)
const settlementAutomation = readBoolean(env.ORACLE_SETTLEMENT_AUTOMATION, true)
const finalizeAutomation = readBoolean(env.ORACLE_FINALIZE_AUTOMATION, true)
const clockTarget = (env.ORACLE_CLOCK_TARGET || 'markets').trim().toLowerCase()
const clockAuthorityOverride = readBoolean(env.ORACLE_CLOCK_AUTHORIZED, false)
const phaseUpdateMinutes = Math.max(1, Number(env.ORACLE_PHASE_UPDATE_MINUTES || 5))
const autoSubmit = !dryRun && (args.has('--autosubmit') || args.has('--submit') || readBoolean(env.ORACLE_AUTOSUBMIT, false))
const startedAt = new Date().toISOString()
const footballDataCache = new Map()

let walletRuntime
let stopping = false
let lastState = {
  status: 'starting',
  startedAt,
  lastRunAt: undefined,
  nextRunAt: undefined,
  runs: 0,
  rooms: 0,
  actions: 0,
  submitted: 0,
  failed: 0,
  resultReady: 0,
  clockReady: 0,
  fallbackReady: 0,
  pending: 0,
  handled: 0,
  error: undefined,
}

function readArg(name) {
  const exact = process.argv.indexOf(name)
  if (exact >= 0) return process.argv[exact + 1]

  const prefix = `${name}=`
  const matched = process.argv.find((arg) => arg.startsWith(prefix))
  return matched ? matched.slice(prefix.length) : undefined
}

function readBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  return ['1', 'true', 'yes', 'y', 'on'].includes(String(value).trim().toLowerCase())
}

function loadEnv(basePath) {
  const output = { ...process.env }

  for (const fileName of ['.env', '.env.local']) {
    const filePath = path.join(basePath, fileName)
    if (!fs.existsSync(filePath)) continue

    const content = fs.readFileSync(filePath, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue

      const [key, ...rest] = trimmed.split('=')
      if (!key) continue

      const rawValue = rest.join('=').trim()
      output[key.trim()] = rawValue.replace(/^["']|["']$/g, '')
    }
  }

  return output
}

function stripHex(value) {
  return value.startsWith('0x') ? value.slice(2) : value
}

function ensure0x(value) {
  return value.startsWith('0x') ? value : `0x${value}`
}

function textToHex(value) {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function hexToText(value) {
  const clean = stripHex(value)
  const bytes = clean.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? []
  return new TextDecoder().decode(new Uint8Array(bytes))
}

function padWord(value) {
  return stripHex(value).padStart(64, '0')
}

function wordAt(data, index) {
  const clean = stripHex(data)
  return clean.slice(index * 64, index * 64 + 64).padStart(64, '0')
}

function readUint(data, index) {
  return BigInt(`0x${wordAt(data, index)}`)
}

function readAddress(data, index) {
  return `0x${wordAt(data, index).slice(24)}`
}

function readString(data, index) {
  const clean = stripHex(data)
  const offset = Number(readUint(data, index))
  const length = Number(BigInt(`0x${clean.slice(offset * 2, offset * 2 + 64) || '0'}`))
  const start = offset * 2 + 64
  return hexToText(clean.slice(start, start + length * 2))
}

function bytesToWord(hex) {
  return stripHex(hex).slice(0, 64).padEnd(64, '0')
}

function encodeUint(value) {
  return padWord(BigInt(value).toString(16))
}

function encodeString(value) {
  const bytes = textToHex(value)
  const paddedLength = Math.ceil(bytes.length / 64) * 64
  return encodeUint(bytes.length / 2) + bytes.padEnd(paddedLength, '0')
}

function encodeArgs(argsToEncode) {
  const head = []
  const tail = []
  let offset = BigInt(argsToEncode.length * 32)

  for (const arg of argsToEncode) {
    if (arg.kind === 'string') {
      const encoded = encodeString(arg.value)
      head.push(encodeUint(offset))
      tail.push(encoded)
      offset += BigInt(encoded.length / 2)
      continue
    }

    if (arg.kind === 'bytes32') {
      head.push(bytesToWord(arg.value))
      continue
    }

    if (arg.kind === 'uint') {
      head.push(encodeUint(arg.value))
    }
  }

  return head.join('') + tail.join('')
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(value || '')
}

function sameAddress(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase()
}

function cleanPrivateKey(value) {
  if (!value) return undefined
  const trimmed = value.trim()
  const prefixed = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`
  if (!/^0x[a-fA-F0-9]{64}$/.test(prefixed)) {
    throw new Error('ORACLE_OPERATOR_PRIVATE_KEY must be a 32-byte hex private key.')
  }
  return prefixed
}

function getWalletRuntime() {
  if (!autoSubmit) return undefined
  if (walletRuntime) return walletRuntime

  const privateKey = cleanPrivateKey(env.ORACLE_OPERATOR_PRIVATE_KEY)
  if (!privateKey) return undefined

  const chain = defineChain({
    id: network.id,
    name: network.name,
    nativeCurrency: { name: 'OKB', symbol: 'OKB', decimals: 18 },
    rpcUrls: {
      default: { http: rpcUrls },
    },
  })
  const account = privateKeyToAccount(privateKey)
  const transport = viemHttp(rpcUrls[0])

  walletRuntime = {
    account,
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account, chain, transport }),
  }

  return walletRuntime
}

async function rpcRequest(method, params = []) {
  const errors = []

  for (const rpcUrl of rpcUrls) {
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
      const payload = await response.json()
      if (payload.error) throw new Error(payload.error.message || `${method} failed`)
      return payload.result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${rpcUrl}: ${message}`)
    }
  }

  throw new Error(`${method} failed across ${rpcUrls.length} RPC endpoint(s): ${errors.join(' | ')}`)
}

async function selector(signature) {
  const value = SELECTORS[signature]
  if (!value) throw new Error(`Missing selector for ${signature}.`)
  return value
}

async function encodeReadCall(signature, argsToEncode = []) {
  return `${await selector(signature)}${encodeArgs(argsToEncode)}`
}

async function callContract(to, data) {
  return rpcRequest('eth_call', [{ to, data }, 'latest'])
}

async function readRoomCount() {
  const data = await encodeReadCall(SIGNATURES.roomCount)
  const result = await callContract(marketsAddress, data)
  return Number(readUint(result, 0))
}

async function readRoomIdAt(index) {
  const data = await encodeReadCall(SIGNATURES.roomIdAt, [{ kind: 'uint', value: index }])
  const result = await callContract(marketsAddress, data)
  return ensure0x(wordAt(result, 0))
}

async function readRoom(roomId) {
  const [metaResult, stateResult] = await Promise.all([
    encodeReadCall(SIGNATURES.getRoomMeta, [{ kind: 'bytes32', value: roomId }]).then((data) => callContract(marketsAddress, data)),
    encodeReadCall(SIGNATURES.getRoomState, [{ kind: 'bytes32', value: roomId }]).then((data) => callContract(marketsAddress, data)),
  ])

  return {
    roomId,
    teamA: readString(metaResult, 0),
    teamB: readString(metaResult, 1),
    kickoff: readString(metaResult, 2),
    creator: readAddress(metaResult, 3),
    createdAt: Number(readUint(metaResult, 4)),
    score: readString(stateResult, 0),
    clock: readString(stateResult, 1),
    phase: PHASE[Number(readUint(stateResult, 2))] || 'unknown',
    settlement: SETTLEMENT[Number(readUint(stateResult, 3))] || 'unknown',
    disputeDeadline: Number(readUint(stateResult, 8)),
    proposer: readAddress(stateResult, 9),
  }
}

async function readRooms() {
  if (!isAddress(marketsAddress)) {
    throw new Error('Set VITE_KICKOFF_MARKETS_ADDRESS in .env before running the oracle worker.')
  }

  const count = await readRoomCount()
  const roomIds = await Promise.all(Array.from({ length: count }, (_, index) => readRoomIdAt(index)))
  return Promise.all(roomIds.map((roomId) => readRoom(roomId)))
}

function normalizeName(value) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')

  const aliases = {
    bosniaherzegovina: 'bosnia',
    bosniaandherzegovina: 'bosnia',
    capeverdeislands: 'capeverde',
    coteivoire: 'ivorycoast',
    curacao: 'curacao',
    korearepublic: 'southkorea',
    unitedstates: 'usa',
    unitedstatesofamerica: 'usa',
  }

  return aliases[normalized] || normalized
}

function teamMatch(a, b) {
  const left = normalizeName(a)
  const right = normalizeName(b)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

function fixtureKey(teamA, teamB, kickoff) {
  const time = Number.isFinite(Date.parse(kickoff)) ? new Date(kickoff).toISOString() : kickoff
  return `${normalizeName(teamA)}:${normalizeName(teamB)}:${time}`
}

function expectedResultTimestamp(room) {
  const kickoff = Date.parse(room.kickoff)
  if (!Number.isFinite(kickoff)) return undefined
  return kickoff + (matchMinutes + resultGraceMinutes) * 60_000
}

function scoreText(home, away) {
  if (!Number.isFinite(home) || !Number.isFinite(away)) return undefined
  return `${home} - ${away}`
}

function readScorePair(score) {
  if (!score) return undefined
  const home = Number(score.home)
  const away = Number(score.away)
  if (!Number.isFinite(home) || !Number.isFinite(away)) return undefined
  return { home, away, text: scoreText(home, away) }
}

function scoreFromFootballMatch(match) {
  return (
    readScorePair(match?.score?.fullTime) ||
    readScorePair(match?.score?.regularTime) ||
    readScorePair(match?.score?.halfTime)
  )
}

function outcomeFromWinner(winner, homeScore, awayScore) {
  const normalized = String(winner || '').toUpperCase()
  if (normalized === 'A' || normalized === 'SIDE_A' || normalized === 'HOME_TEAM') return OUTCOME.sideA
  if (normalized === 'B' || normalized === 'SIDE_B' || normalized === 'AWAY_TEAM') return OUTCOME.sideB
  if (normalized === 'CANCEL' || normalized === 'CANCELLED' || normalized === 'CANCELED' || normalized === 'DRAW') return OUTCOME.cancel
  if (Number.isFinite(homeScore) && Number.isFinite(awayScore)) {
    if (homeScore > awayScore) return OUTCOME.sideA
    if (awayScore > homeScore) return OUTCOME.sideB
    return OUTCOME.cancel
  }
  return undefined
}

function normalizeManualResult(entry) {
  const homeScore = Number(entry.homeScore ?? entry.scoreA ?? entry.home ?? entry.goalsA)
  const awayScore = Number(entry.awayScore ?? entry.scoreB ?? entry.away ?? entry.goalsB)
  const outcome = Number(entry.outcome) || outcomeFromWinner(entry.winner, homeScore, awayScore)
  const score = entry.score || scoreText(homeScore, awayScore)

  if (!outcome || !score) return undefined

  return {
    outcome,
    score,
    clock: entry.clock || 'FT',
    source: entry.source || 'manual result file',
  }
}

async function loadManualResult(room) {
  const filePath = path.resolve(root, env.ORACLE_RESULTS_FILE || 'scripts/oracle-results.json')
  if (!fs.existsSync(filePath)) return undefined

  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const rows = Array.isArray(content) ? content : content.matches || content.results || []
  const match = rows.find((entry) => {
    if (entry.roomId && entry.roomId.toLowerCase() === room.roomId.toLowerCase()) return true
    return teamMatch(entry.teamA || entry.homeTeam || entry.home || '', room.teamA) && teamMatch(entry.teamB || entry.awayTeam || entry.away || '', room.teamB)
  })

  return match ? normalizeManualResult(match) : undefined
}

async function loadGenericResult(room) {
  if (!env.ORACLE_RESULT_ENDPOINT) return undefined

  const url = new URL(env.ORACLE_RESULT_ENDPOINT)
  url.searchParams.set('teamA', room.teamA)
  url.searchParams.set('teamB', room.teamB)
  url.searchParams.set('kickoff', room.kickoff)
  url.searchParams.set('roomId', room.roomId)

  const response = await fetch(url, {
    headers: env.ORACLE_RESULT_API_KEY ? { authorization: `Bearer ${env.ORACLE_RESULT_API_KEY}` } : undefined,
  })
  if (!response.ok) throw new Error(`Generic oracle endpoint returned ${response.status}`)

  const payload = await response.json()
  const rows = Array.isArray(payload) ? payload : payload.matches || payload.results || [payload]
  const match = rows.find((entry) => {
    if (entry.roomId && entry.roomId.toLowerCase() === room.roomId.toLowerCase()) return true
    return teamMatch(entry.teamA || entry.homeTeam || entry.home || '', room.teamA) && teamMatch(entry.teamB || entry.awayTeam || entry.away || '', room.teamB)
  })

  return match ? normalizeManualResult({ ...match, source: 'generic oracle endpoint' }) : undefined
}

async function footballDataRequest(pathname, params = {}) {
  if (!env.FOOTBALL_DATA_API_TOKEN) {
    throw new Error('Set FOOTBALL_DATA_API_TOKEN in .env before using football-data.org.')
  }

  const url = new URL(`https://api.football-data.org/v4${pathname}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, value)
  }

  const response = await fetch(url, {
    headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_TOKEN },
  })
  const text = await response.text()
  let payload

  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = { raw: text }
  }

  if (!response.ok) {
    throw new Error(`football-data.org ${response.status}: ${payload.message || text || response.statusText}`)
  }

  return payload
}

async function footballDataMatches(competition, dateFrom, dateTo, status = '') {
  const cacheKey = `${competition}:${dateFrom}:${dateTo}:${status}`
  if (footballDataCache.has(cacheKey)) return footballDataCache.get(cacheKey)

  const payload = await footballDataRequest(`/competitions/${competition}/matches`, {
    dateFrom,
    dateTo,
    status,
  })
  const matches = payload.matches || []
  footballDataCache.set(cacheKey, matches)
  return matches
}

async function loadFootballDataMatch(room) {
  const kickoff = Date.parse(room.kickoff)
  if (!Number.isFinite(kickoff)) return undefined

  const date = new Date(kickoff).toISOString().slice(0, 10)
  const competition = env.ORACLE_FOOTBALL_DATA_COMPETITION || 'WC'
  const matches = await footballDataMatches(competition, date, date)

  return matches.find((entry) => {
    const home = entry.homeTeam?.name || ''
    const away = entry.awayTeam?.name || ''
    return teamMatch(home, room.teamA) && teamMatch(away, room.teamB)
  })
}

function resultFromFootballMatch(match) {
  if (!match) return undefined

  const status = String(match.status || '').toUpperCase()
  if (CANCELLED_STATUSES.has(status)) {
    return { outcome: OUTCOME.cancel, score: 'VOID', clock: status, source: 'football-data.org' }
  }

  if (!FINAL_STATUSES.has(status)) return undefined

  const score = scoreFromFootballMatch(match)
  const outcome = outcomeFromWinner(match.score?.winner, score?.home, score?.away)
  if (!outcome || !score?.text) return undefined

  return { outcome, score: score.text, clock: 'FT', source: 'football-data.org' }
}

function estimatedClock(room) {
  const kickoff = Date.parse(room.kickoff)
  if (!Number.isFinite(kickoff)) return room.clock || 'LIVE'

  const elapsed = Math.max(0, Math.floor((Date.now() - kickoff) / 60_000))
  if (elapsed <= 45) return `${Math.max(1, elapsed)}'`
  if (elapsed <= 60) return 'HT'
  return `${Math.min(matchMinutes, elapsed - 15)}'`
}

function clockFromFootballMatch(room, match) {
  if (!match || room.settlement !== 'open') return undefined

  const status = String(match.status || '').toUpperCase()
  if (FINAL_STATUSES.has(status) || CANCELLED_STATUSES.has(status) || POSTPONED_STATUSES.has(status)) return undefined

  const score = scoreFromFootballMatch(match)?.text || room.score || '0 - 0'

  if (HALFTIME_STATUSES.has(status)) {
    return {
      phase: 'halftime',
      clock: 'HT',
      score,
      feeBps: 34,
      source: 'football-data.org',
    }
  }

  if (LIVE_STATUSES.has(status)) {
    return {
      phase: 'live',
      clock: estimatedClock(room),
      score,
      feeBps: 46,
      source: 'football-data.org',
    }
  }

  return undefined
}

async function loadFootballDataSnapshot(room) {
  const match = await loadFootballDataMatch(room)
  return {
    providerStatus: match?.status,
    providerMatch: match,
    result: resultFromFootballMatch(match),
    clock: clockFromFootballMatch(room, match),
  }
}

async function loadProviderSnapshot(room) {
  if (providerName === 'football-data') return loadFootballDataSnapshot(room)
  if (providerName === 'generic') return { result: await loadGenericResult(room) }
  return { result: await loadManualResult(room) }
}

function clockDiffers(room, desired) {
  if (!desired) return false
  if (room.phase !== desired.phase) return true
  if (room.score !== desired.score) return true
  if (room.clock === desired.clock) return false

  const currentMinute = Number(String(room.clock).replace(/[^0-9]/g, ''))
  const nextMinute = Number(String(desired.clock).replace(/[^0-9]/g, ''))
  if (Number.isFinite(currentMinute) && Number.isFinite(nextMinute)) {
    return Math.abs(nextMinute - currentMinute) >= phaseUpdateMinutes
  }

  return true
}

function buildAction({ kind, target, to, abi, functionName, args: actionArgs, method, permission, roomCreator }) {
  return {
    kind,
    target,
    to,
    method,
    functionName,
    args: actionArgs,
    calldata: encodeFunctionData({ abi, functionName, args: actionArgs }),
    permission,
    roomCreator,
    submitted: false,
    submitStatus: 'not-submitted',
  }
}

function buildClockAction(room, desiredClock) {
  if (!desiredClock) return undefined

  const phase = PHASE_CODE[desiredClock.phase]
  if (phase === undefined) return undefined

  if (clockTarget === 'agent') {
    if (!isAddress(oracleAgentAddress)) return undefined
    return buildAction({
      kind: 'clock',
      target: 'MatchOracleAgent',
      to: oracleAgentAddress,
      abi: ORACLE_AGENT_ABI,
      functionName: 'submitClock',
      method: 'submitClock(bytes32,uint8,string,string,uint16)',
      args: [room.roomId, phase, desiredClock.clock, desiredClock.score, desiredClock.feeBps],
      permission: 'oracle operator via upgraded MatchOracleAgent',
      roomCreator: room.creator,
    })
  }

  return buildAction({
    kind: 'clock',
    target: 'KickoffMarkets',
    to: marketsAddress,
    abi: MARKET_ABI,
    functionName: 'updatePhase',
    method: 'updatePhase(bytes32,uint8,string,string,uint16)',
    args: [room.roomId, phase, desiredClock.clock, desiredClock.score, desiredClock.feeBps],
    permission: 'room creator, owner, clockOperator, or oracleAgent',
    roomCreator: room.creator,
  })
}

function buildSettlementAction(room, result) {
  if (!isAddress(oracleAgentAddress)) return undefined

  const functionName = room.settlement === 'disputed' ? 'resolveResult' : 'submitResult'
  return buildAction({
    kind: room.settlement === 'disputed' ? 'resolve-dispute' : 'settlement',
    target: 'MatchOracleAgent',
    to: oracleAgentAddress,
    abi: ORACLE_AGENT_ABI,
    functionName,
    method: `${functionName}(bytes32,uint8,string,string)`,
    args: [room.roomId, result.outcome, result.score, result.clock],
    permission: 'oracle operator',
    roomCreator: room.creator,
  })
}

function buildFinalizeAction(room) {
  return buildAction({
    kind: 'finalize',
    target: 'KickoffMarkets',
    to: marketsAddress,
    abi: MARKET_ABI,
    functionName: 'finalizeSettlement',
    method: 'finalizeSettlement(bytes32)',
    args: [room.roomId],
    permission: 'any wallet',
    roomCreator: room.creator,
  })
}

function buildCreateRoomAction(fixture) {
  return buildAction({
    kind: 'create-room',
    target: 'KickoffMarkets',
    to: marketsAddress,
    abi: MARKET_ABI,
    functionName: 'createRoom',
    method: 'createRoom(string,string,string)',
    args: [fixture.teamA, fixture.teamB, fixture.kickoff],
    permission: 'any wallet',
    roomCreator: '',
  })
}

async function submitAction(action) {
  if (!autoSubmit) return action

  const runtime = getWalletRuntime()
  if (!runtime) {
    action.submitStatus = 'not-configured'
    action.submitMessage = 'Set ORACLE_OPERATOR_PRIVATE_KEY to enable backend signing.'
    return action
  }

  if (
    action.kind === 'clock' &&
    action.target === 'KickoffMarkets' &&
    !clockAuthorityOverride &&
    !sameAddress(runtime.account.address, action.roomCreator)
  ) {
    action.submitStatus = 'blocked'
    action.submitMessage =
      'Clock updates on KickoffMarkets require creator/owner/clockOperator permission. Set ORACLE_CLOCK_AUTHORIZED=true only after setClockOperator is configured.'
    return action
  }

  try {
    const hash = await runtime.walletClient.writeContract({
      address: action.to,
      abi: action.target === 'MatchOracleAgent' ? ORACLE_AGENT_ABI : MARKET_ABI,
      functionName: action.functionName,
      args: action.args,
    })
    const receipt = await runtime.publicClient.waitForTransactionReceipt({ hash })
    action.submitted = true
    action.submitStatus = receipt.status === 'success' ? 'confirmed' : 'reverted'
    action.txHash = hash
  } catch (error) {
    action.submitStatus = 'failed'
    action.submitMessage = error instanceof Error ? error.shortMessage || error.message : String(error)
  }

  return action
}

async function inspectRoom(room) {
  const item = {
    room,
    status: 'oracle-pending',
    actions: [],
    message: '',
  }

  const dueAt = expectedResultTimestamp(room)
  const now = Date.now()

  if (room.settlement !== 'open' && room.settlement !== 'disputed') {
    item.status = 'already-handled'
    item.message = `Settlement state is ${room.settlement}.`
    return item
  }

  const snapshot = await loadProviderSnapshot(room)
  item.providerStatus = snapshot.providerStatus

  if (clockAutomation && room.settlement === 'open' && snapshot.clock && clockDiffers(room, snapshot.clock)) {
    const clockAction = buildClockAction(room, snapshot.clock)
    if (clockAction) item.actions.push(clockAction)
    item.status = 'clock-ready'
    item.message = `Live clock update verified by ${snapshot.clock.source}.`
  }

  if (room.settlement === 'disputed') {
    if (settlementAutomation && snapshot.result) {
      const action = buildSettlementAction(room, snapshot.result)
      if (action) item.actions.push(action)
      item.result = snapshot.result
      item.status = 'result-ready'
      item.message = `Dispute can be resolved with ${snapshot.result.source}.`
    } else {
      item.status = 'creator-fallback-enabled'
      item.message = 'Room is disputed and no verified result is available from the configured provider.'
    }
  } else if (room.settlement === 'open' && settlementAutomation) {
    if (snapshot.result && (!dueAt || now >= dueAt || providerName === 'football-data')) {
      const action = buildSettlementAction(room, snapshot.result)
      if (action) item.actions.push(action)
      item.result = snapshot.result
      item.status = 'result-ready'
      item.message = `Result verified by ${snapshot.result.source}.`
    } else if (dueAt && now >= dueAt) {
      item.status = 'creator-fallback-enabled'
      item.dueAt = new Date(dueAt).toISOString()
      item.message = 'No verified result available from the configured provider. Creator fallback remains available.'
    } else {
      item.status = item.actions.length ? item.status : 'oracle-pending'
      item.dueAt = dueAt ? new Date(dueAt).toISOString() : undefined
      if (!item.message) item.message = dueAt ? 'Waiting for expected full-time window.' : 'Kickoff time is not parseable.'
    }
  }

  if (
    finalizeAutomation &&
    ['proposed-cancel', 'proposed-a', 'proposed-b'].includes(room.settlement) &&
    room.disputeDeadline > 0 &&
    now >= room.disputeDeadline * 1000
  ) {
    item.actions.push(buildFinalizeAction(room))
    item.status = 'finalize-ready'
    item.message = 'Optimistic dispute window has closed; room can be finalized.'
  }

  for (const action of item.actions) {
    await submitAction(action)
  }

  return item
}

function summarize(items) {
  const actions = items.flatMap((item) => item.actions || [])

  return {
    rooms: items.length,
    actions: actions.length,
    submitted: actions.filter((action) => action.submitted).length,
    failed: actions.filter((action) => action.submitStatus === 'failed' || action.submitStatus === 'reverted').length,
    resultReady: items.filter((item) => item.status === 'result-ready').length,
    clockReady: items.filter((item) => item.status === 'clock-ready').length,
    fallbackReady: items.filter((item) => item.status === 'creator-fallback-enabled').length,
    pending: items.filter((item) => item.status === 'oracle-pending').length,
    handled: items.filter((item) => item.status === 'already-handled').length,
  }
}

function cleanAction(action) {
  const { abi, ...rest } = action
  return rest
}

function cleanItem(item) {
  return {
    ...item,
    actions: (item.actions || []).map(cleanAction),
  }
}

function printReport(items, heading = 'Kickoff Markets oracle worker') {
  const cleanItems = items.map(cleanItem)

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          network: network.name,
          provider: providerName,
          dryRun,
          autoSubmit,
          watch: watchMode,
          items: cleanItems,
        },
        null,
        2,
      ),
    )
    return
  }

  const summary = summarize(items)
  console.log(heading)
  console.log(`Network: ${network.name}`)
  console.log(`Provider: ${providerName}${dryRun ? ' (dry run)' : ''}`)
  console.log(`Mode: ${watchMode ? `watching every ${pollSeconds}s` : importMode ? 'fixture import' : 'one-shot check'}`)
  console.log(`Autosubmit: ${autoSubmit ? 'enabled' : 'disabled'}`)
  console.log(`Rooms/items inspected: ${items.length}`)
  console.log(`Actions: ${summary.actions} (${summary.submitted} submitted, ${summary.failed} failed)`)
  console.log('')

  for (const item of items) {
    const room = item.room
    const title = room ? `${room.teamA} vs ${room.teamB}` : `${item.fixture.teamA} vs ${item.fixture.teamB}`
    console.log(`[${item.status}] ${title}`)
    if (room) {
      console.log(`roomId: ${room.roomId}`)
      console.log(`kickoff: ${room.kickoff}`)
      console.log(`state: ${room.phase} / ${room.settlement}`)
    } else {
      console.log(`kickoff: ${item.fixture.kickoff}`)
    }
    if (item.providerStatus) console.log(`provider status: ${item.providerStatus}`)
    console.log(item.message)

    if (item.result) {
      console.log(`result: outcome ${item.result.outcome}, score ${item.result.score}, clock ${item.result.clock}`)
    }

    for (const action of item.actions || []) {
      console.log(`action: ${action.kind} via ${action.target}`)
      console.log(`to: ${action.to}`)
      console.log(`method: ${action.method}`)
      console.log(`permission: ${action.permission}`)
      console.log(`calldata: ${action.calldata}`)
      if (action.txHash) console.log(`tx: ${action.txHash}`)
      if (action.submitStatus !== 'not-submitted') console.log(`submit: ${action.submitStatus}`)
      if (action.submitMessage) console.log(`submit message: ${action.submitMessage}`)
    }

    console.log('')
  }
}

async function inspectAllRooms() {
  const rooms = await readRooms()
  const inspected = []

  for (const room of rooms) {
    inspected.push(await inspectRoom(room))
  }

  return inspected
}

function formatProbeMatch(match) {
  const home = match.homeTeam?.name || 'TBD'
  const away = match.awayTeam?.name || 'TBD'
  const utcDate = match.utcDate || 'TBD'
  const status = match.status || 'UNKNOWN'
  const score = scoreFromFootballMatch(match)?.text || 'no score'

  return `${utcDate} | ${status} | ${home} vs ${away} | ${score}`
}

async function probeFootballData() {
  const [competitions, matches] = await Promise.all([
    footballDataRequest('/competitions'),
    footballDataRequest(`/competitions/${probeCompetition}/matches`, {
      dateFrom: probeDateFrom,
      dateTo: probeDateTo,
      status: probeStatus,
    }),
  ])

  const availableCompetitions = (competitions.competitions || []).map((competition) => ({
    code: competition.code,
    name: competition.name,
    area: competition.area?.name,
    currentSeason: competition.currentSeason?.startDate
      ? `${competition.currentSeason.startDate} to ${competition.currentSeason.endDate}`
      : 'n/a',
  }))
  const returnedMatches = matches.matches || []

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          provider: 'football-data',
          competition: probeCompetition,
          dateFrom: probeDateFrom,
          dateTo: probeDateTo,
          status: probeStatus || 'any',
          competitions: availableCompetitions,
          matches: returnedMatches,
        },
        null,
        2,
      ),
    )
    return
  }

  console.log('football-data.org probe')
  console.log(`Competition: ${probeCompetition}`)
  console.log(`Date range: ${probeDateFrom} to ${probeDateTo}`)
  console.log(`Status: ${probeStatus || 'any'}`)
  console.log('')
  console.log(`Accessible competitions: ${availableCompetitions.length}`)
  for (const competition of availableCompetitions.slice(0, 20)) {
    console.log(`- ${competition.code || 'NO_CODE'} | ${competition.name} | ${competition.area || 'n/a'} | ${competition.currentSeason}`)
  }
  if (availableCompetitions.length > 20) {
    console.log(`...and ${availableCompetitions.length - 20} more`)
  }

  console.log('')
  console.log(`Matches returned: ${returnedMatches.length}`)
  for (const match of returnedMatches.slice(0, 40)) {
    console.log(`- ${formatProbeMatch(match)}`)
  }
  if (returnedMatches.length > 40) {
    console.log(`...and ${returnedMatches.length - 40} more`)
  }
}

async function importFixtures() {
  if (providerName !== 'football-data') {
    throw new Error('Fixture import requires ORACLE_PROVIDER=football-data.')
  }

  if (!isAddress(marketsAddress)) {
    throw new Error('Set VITE_KICKOFF_MARKETS_ADDRESS before importing fixtures.')
  }

  const [rooms, matches] = await Promise.all([
    readRooms(),
    footballDataMatches(importCompetition, importDateFrom, importDateTo, importStatus),
  ])

  const existing = new Set(rooms.map((room) => fixtureKey(room.teamA, room.teamB, room.kickoff)))
  const fixtures = matches
    .filter((match) => match.homeTeam?.name && match.awayTeam?.name && match.utcDate)
    .map((match) => ({
      teamA: match.homeTeam.name,
      teamB: match.awayTeam.name,
      kickoff: new Date(match.utcDate).toISOString(),
      status: match.status,
    }))
    .filter((fixture) => !existing.has(fixtureKey(fixture.teamA, fixture.teamB, fixture.kickoff)))
    .slice(0, importLimit)

  const items = fixtures.map((fixture) => ({
    fixture,
    status: 'fixture-ready',
    message: 'Fixture is not on-chain yet.',
    actions: [buildCreateRoomAction(fixture)],
  }))

  for (const item of items) {
    for (const action of item.actions) {
      await submitAction(action)
    }
    if (item.actions.some((action) => action.submitted)) {
      item.status = 'fixture-created'
      item.message = 'Fixture creation transaction submitted.'
    }
  }

  if (items.length === 0) {
    return [
      {
        fixture: { teamA: importCompetition, teamB: 'fixtures', kickoff: `${importDateFrom} to ${importDateTo}` },
        status: 'nothing-to-import',
        message: 'All provider fixtures in the selected date range already exist on-chain, or no fixtures were returned.',
        actions: [],
      },
    ]
  }

  return items
}

function startHealthServer() {
  if (!healthPort) return undefined

  const server = nodeHttp.createServer((request, response) => {
    const statusCode = lastState.status === 'error' ? 503 : 200
    const payload = {
      service: 'kickoff-markets-oracle-worker',
      network: network.name,
      provider: providerName,
      dryRun,
      autoSubmit,
      watch: watchMode,
      ...lastState,
    }

    if (request.url === '/health' || request.url === '/ready' || request.url === '/') {
      response.writeHead(statusCode, { 'content-type': 'application/json' })
      response.end(JSON.stringify(payload))
      return
    }

    response.writeHead(404, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ error: 'not found' }))
  })

  server.listen(healthPort, () => {
    if (!jsonMode) {
      console.log(`Health endpoint listening on http://localhost:${healthPort}/health`)
    }
  })

  return server
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runOnce() {
  lastState = {
    ...lastState,
    status: 'checking',
    error: undefined,
  }

  const items = importMode ? await importFixtures() : await inspectAllRooms()
  const summary = summarize(items)
  lastState = {
    ...lastState,
    status: 'idle',
    lastRunAt: new Date().toISOString(),
    nextRunAt: watchMode ? new Date(Date.now() + pollSeconds * 1000).toISOString() : undefined,
    runs: lastState.runs + 1,
    ...summary,
    error: undefined,
  }

  printReport(items, importMode ? 'Kickoff Markets fixture importer' : 'Kickoff Markets oracle worker')
  return items
}

async function main() {
  const server = startHealthServer()

  if (probeMode) {
    await probeFootballData()
    server?.close()
    return
  }

  process.on('SIGINT', () => {
    stopping = true
    if (!jsonMode) console.log('Stopping oracle worker...')
  })
  process.on('SIGTERM', () => {
    stopping = true
    if (!jsonMode) console.log('Stopping oracle worker...')
  })

  if (!watchMode) {
    await runOnce()
    server?.close()
    return
  }

  if (!jsonMode) {
    console.log(`Kickoff Markets oracle watcher started on ${network.name}`)
    console.log(`Provider: ${providerName}${dryRun ? ' (dry run)' : ''}`)
    console.log(`Autosubmit: ${autoSubmit ? 'enabled' : 'disabled'}`)
    console.log(`Polling every ${pollSeconds}s`)
    console.log('')
  }

  while (!stopping) {
    try {
      await runOnce()
    } catch (error) {
      lastState = {
        ...lastState,
        status: 'error',
        lastRunAt: new Date().toISOString(),
        nextRunAt: new Date(Date.now() + pollSeconds * 1000).toISOString(),
        runs: lastState.runs + 1,
        error: error instanceof Error ? error.message : String(error),
      }

      if (jsonMode) {
        console.error(JSON.stringify({ error: lastState.error }))
      } else {
        console.error(lastState.error)
      }
    }

    if (maxRuns > 0 && lastState.runs >= maxRuns) break
    if (!stopping) await sleep(pollSeconds * 1000)
  }

  server?.close()
}

main().catch((error) => {
  if (jsonMode) {
    console.error(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }))
  } else {
    console.error(error instanceof Error ? error.message : error)
  }
  process.exitCode = 1
})
