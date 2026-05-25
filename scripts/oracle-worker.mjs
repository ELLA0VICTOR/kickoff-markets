#!/usr/bin/env node
import dns from 'node:dns'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'

dns.setDefaultResultOrder('ipv4first')

const NETWORKS = {
  mainnet: {
    name: 'X Layer Mainnet',
    rpcUrls: ['https://rpc.xlayer.tech', 'https://xlayerrpc.okx.com'],
  },
  testnet: {
    name: 'X Layer Testnet',
    rpcUrls: ['https://testrpc.xlayer.tech/terigon', 'https://xlayertestrpc.okx.com/terigon'],
  },
}

const SIGNATURES = {
  roomCount: 'roomCount()',
  roomIdAt: 'roomIdAt(uint256)',
  getRoomMeta: 'getRoomMeta(bytes32)',
  getRoomState: 'getRoomState(bytes32)',
  submitResult: 'submitResult(bytes32,uint8,string,string)',
  resolveResult: 'resolveResult(bytes32,uint8,string,string)',
}

const SELECTORS = {
  [SIGNATURES.roomCount]: '0xdf93a4e3',
  [SIGNATURES.roomIdAt]: '0x2d9c15e6',
  [SIGNATURES.getRoomMeta]: '0x0e0c4f72',
  [SIGNATURES.getRoomState]: '0x41ac4f6d',
  [SIGNATURES.submitResult]: '0xe7491b29',
  [SIGNATURES.resolveResult]: '0xbd32aebb',
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

const OUTCOME = {
  cancel: 1,
  sideA: 2,
  sideB: 3,
}

const args = new Set(process.argv.slice(2))
const jsonMode = args.has('--json')
const dryRun = args.has('--dry-run') || args.has('--dry')
const watchMode = args.has('--watch')
const root = process.cwd()
const env = loadEnv(root)
const networkId = env.VITE_X_LAYER_NETWORK?.trim().toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet'
const network = NETWORKS[networkId]
const rpcUrls = env.X_LAYER_RPC_URL?.trim() ? [env.X_LAYER_RPC_URL.trim()] : network.rpcUrls
const marketsAddress = env.VITE_KICKOFF_MARKETS_ADDRESS?.trim()
const oracleAgentAddress = env.VITE_MATCH_ORACLE_AGENT_ADDRESS?.trim()
const providerName = env.ORACLE_PROVIDER?.trim().toLowerCase() || 'manual'
const resultGraceMinutes = Number(env.ORACLE_RESULT_GRACE_MINUTES || 30)
const matchMinutes = Number(env.ORACLE_MATCH_MINUTES || 90)
const pollSeconds = Math.max(10, Number(readArg('--poll-seconds') || env.ORACLE_POLL_SECONDS || 60))
const healthPort = Number(readArg('--health-port') || env.ORACLE_HEALTH_PORT || 0)
const maxRuns = Number(readArg('--max-runs') || env.ORACLE_MAX_RUNS || 0)
const startedAt = new Date().toISOString()
let stopping = false
let lastState = {
  status: 'starting',
  startedAt,
  lastRunAt: undefined,
  nextRunAt: undefined,
  runs: 0,
  rooms: 0,
  resultReady: 0,
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

async function encodeCall(signature, argsToEncode = []) {
  return `${await selector(signature)}${encodeArgs(argsToEncode)}`
}

async function callContract(to, data) {
  return rpcRequest('eth_call', [{ to, data }, 'latest'])
}

async function readRoomCount() {
  const data = await encodeCall(SIGNATURES.roomCount)
  const result = await callContract(marketsAddress, data)
  return Number(readUint(result, 0))
}

async function readRoomIdAt(index) {
  const data = await encodeCall(SIGNATURES.roomIdAt, [{ kind: 'uint', value: index }])
  const result = await callContract(marketsAddress, data)
  return ensure0x(wordAt(result, 0))
}

async function readRoom(roomId) {
  const [metaResult, stateResult] = await Promise.all([
    encodeCall(SIGNATURES.getRoomMeta, [{ kind: 'bytes32', value: roomId }]).then((data) => callContract(marketsAddress, data)),
    encodeCall(SIGNATURES.getRoomState, [{ kind: 'bytes32', value: roomId }]).then((data) => callContract(marketsAddress, data)),
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

function normalizeName(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function teamMatch(a, b) {
  const left = normalizeName(a)
  const right = normalizeName(b)
  return left.includes(right) || right.includes(left)
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

function outcomeFromWinner(winner, homeScore, awayScore) {
  const normalized = String(winner || '').toUpperCase()
  if (normalized === 'A' || normalized === 'SIDE_A' || normalized === 'HOME_TEAM') return OUTCOME.sideA
  if (normalized === 'B' || normalized === 'SIDE_B' || normalized === 'AWAY_TEAM') return OUTCOME.sideB
  if (normalized === 'CANCEL' || normalized === 'CANCELLED' || normalized === 'DRAW') return OUTCOME.cancel
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

async function loadFootballDataResult(room) {
  if (!env.FOOTBALL_DATA_API_TOKEN) return undefined

  const kickoff = Date.parse(room.kickoff)
  if (!Number.isFinite(kickoff)) return undefined

  const date = new Date(kickoff).toISOString().slice(0, 10)
  const url = new URL('https://api.football-data.org/v4/matches')
  url.searchParams.set('dateFrom', date)
  url.searchParams.set('dateTo', date)

  const response = await fetch(url, {
    headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_TOKEN },
  })
  if (!response.ok) throw new Error(`football-data.org returned ${response.status}`)

  const payload = await response.json()
  const match = (payload.matches || []).find((entry) => {
    const home = entry.homeTeam?.name || ''
    const away = entry.awayTeam?.name || ''
    return teamMatch(home, room.teamA) && teamMatch(away, room.teamB)
  })
  if (!match || !['FINISHED', 'AWARDED'].includes(match.status)) return undefined

  const homeScore = Number(match.score?.fullTime?.home)
  const awayScore = Number(match.score?.fullTime?.away)
  const outcome = outcomeFromWinner(match.score?.winner, homeScore, awayScore)
  const score = scoreText(homeScore, awayScore)
  if (!outcome || !score) return undefined

  return { outcome, score, clock: 'FT', source: 'football-data.org' }
}

async function loadResult(room) {
  if (providerName === 'football-data') return loadFootballDataResult(room)
  if (providerName === 'generic') return loadGenericResult(room)
  return loadManualResult(room)
}

async function buildAgentCall(room, result) {
  if (!isAddress(oracleAgentAddress)) return undefined

  const signature = room.settlement === 'disputed' ? SIGNATURES.resolveResult : SIGNATURES.submitResult
  const data = await encodeCall(signature, [
    { kind: 'bytes32', value: room.roomId },
    { kind: 'uint', value: result.outcome },
    { kind: 'string', value: result.score },
    { kind: 'string', value: result.clock },
  ])

  return {
    to: oracleAgentAddress,
    method: signature,
    calldata: data,
  }
}

async function inspectRoom(room) {
  if (room.settlement !== 'open' && room.settlement !== 'disputed') {
    return {
      room,
      status: 'already-handled',
      message: `Settlement state is ${room.settlement}.`,
    }
  }

  const dueAt = expectedResultTimestamp(room)
  if (!dueAt) {
    return {
      room,
      status: 'operator-time-required',
      message: 'Kickoff time is not parseable. Creator fallback remains available.',
    }
  }

  if (Date.now() < dueAt && !dryRun) {
    return {
      room,
      status: 'oracle-pending',
      dueAt: new Date(dueAt).toISOString(),
      message: 'Waiting for expected full-time window.',
    }
  }

  const result = await loadResult(room)
  if (!result) {
    return {
      room,
      status: 'creator-fallback-enabled',
      dueAt: new Date(dueAt).toISOString(),
      message: 'No verified result available from the configured provider.',
    }
  }

  const call = await buildAgentCall(room, result)
  return {
    room,
    result,
    call,
    status: 'result-ready',
    dueAt: new Date(dueAt).toISOString(),
    message: `Verified by ${result.source}.`,
  }
}

function summarize(items) {
  return {
    rooms: items.length,
    resultReady: items.filter((item) => item.status === 'result-ready').length,
    fallbackReady: items.filter((item) => item.status === 'creator-fallback-enabled').length,
    pending: items.filter((item) => item.status === 'oracle-pending' || item.status === 'operator-time-required').length,
    handled: items.filter((item) => item.status === 'already-handled').length,
  }
}

function printReport(items) {
  if (jsonMode) {
    console.log(JSON.stringify({ network: network.name, provider: providerName, dryRun, watch: watchMode, items }, null, 2))
    return
  }

  console.log(`Kickoff Markets oracle worker`)
  console.log(`Network: ${network.name}`)
  console.log(`Provider: ${providerName}${dryRun ? ' (dry run)' : ''}`)
  console.log(`Mode: ${watchMode ? `watching every ${pollSeconds}s` : 'one-shot check'}`)
  console.log(`Rooms inspected: ${items.length}`)
  console.log('')

  for (const item of items) {
    const room = item.room
    console.log(`[${item.status}] ${room.teamA} vs ${room.teamB}`)
    console.log(`roomId: ${room.roomId}`)
    console.log(`kickoff: ${room.kickoff}`)
    console.log(`state: ${room.phase} / ${room.settlement}`)
    console.log(item.message)

    if (item.result) {
      console.log(`result: outcome ${item.result.outcome}, score ${item.result.score}, clock ${item.result.clock}`)
    }

    if (item.call) {
      console.log(`agent: ${item.call.to}`)
      console.log(`method: ${item.call.method}`)
      console.log(`calldata: ${item.call.calldata}`)
    } else if (item.status === 'result-ready') {
      console.log('agent: configure VITE_MATCH_ORACLE_AGENT_ADDRESS to generate calldata.')
    }

    console.log('')
  }
}

async function inspectAllRooms() {
  if (!isAddress(marketsAddress)) {
    throw new Error('Set VITE_KICKOFF_MARKETS_ADDRESS in .env before running the oracle worker.')
  }

  const count = await readRoomCount()
  const roomIds = await Promise.all(Array.from({ length: count }, (_, index) => readRoomIdAt(index)))
  const rooms = await Promise.all(roomIds.map((roomId) => readRoom(roomId)))
  const inspected = []

  for (const room of rooms) {
    inspected.push(await inspectRoom(room))
  }

  return inspected
}

function startHealthServer() {
  if (!healthPort) return undefined

  const server = http.createServer((request, response) => {
    const statusCode = lastState.status === 'error' ? 503 : 200
    const payload = {
      service: 'kickoff-markets-oracle-worker',
      network: network.name,
      provider: providerName,
      dryRun,
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

  const items = await inspectAllRooms()
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

  printReport(items)
  return items
}

async function main() {
  const server = startHealthServer()

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
