import { KICKOFF_MARKETS_ADDRESS, isKickoffContractConfigured } from '../config/contracts'
import type { MatchMarket } from '../data/markets'
import type { EthereumProvider } from './wallet'

export type ContractActionResult =
  | {
      mode: 'onchain'
      txHash: string
    }
  | {
      mode: 'demo'
      txHash?: undefined
    }

type TransactionRequest = {
  from: string
  to: string
  data: string
  value?: string
}

const CREATE_ROOM_SIG = 'createRoom(string,string,string)'
const PLACE_TRADE_SIG = 'placeTrade(bytes32,uint8,uint256)'
const ADD_LIQUIDITY_SIG = 'addLiquidity(bytes32,uint8,uint256)'
const CLAIM_SIG = 'claim(bytes32)'

function stripHex(value: string) {
  return value.startsWith('0x') ? value.slice(2) : value
}

function padWord(value: string) {
  return stripHex(value).padStart(64, '0')
}

function textToHex(value: string) {
  return Array.from(new TextEncoder().encode(value))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function bytesToWord(hex: string) {
  const clean = stripHex(hex).slice(0, 64)
  return clean.padEnd(64, '0')
}

function encodeUint(value: bigint | number) {
  return padWord(BigInt(value).toString(16))
}

function encodeString(value: string) {
  const bytes = textToHex(value)
  const paddedLength = Math.ceil(bytes.length / 64) * 64
  return encodeUint(bytes.length / 2) + bytes.padEnd(paddedLength, '0')
}

function encodeDynamicStrings(values: string[]) {
  const headWords: string[] = []
  const tailWords: string[] = []
  let offset = BigInt(values.length * 32)

  for (const value of values) {
    const encoded = encodeString(value)
    headWords.push(encodeUint(offset))
    tailWords.push(encoded)
    offset += BigInt(encoded.length / 2)
  }

  return headWords.join('') + tailWords.join('')
}

async function selector(provider: EthereumProvider, signature: string) {
  const signatureHex = `0x${textToHex(signature)}`
  const hash = await provider.request<string>({
    method: 'web3_sha3',
    params: [signatureHex],
  })

  return hash.slice(0, 10)
}

function roomIdFor(market: MatchMarket) {
  return `0x${bytesToWord(textToHex(market.pool))}`
}

export function parseUsdcAmount(value: string) {
  const [whole, decimal = ''] = value.trim().replaceAll(',', '').split('.')
  const wholeUnits = BigInt(whole || '0') * 1_000_000n
  const decimalUnits = BigInt((decimal + '000000').slice(0, 6) || '0')
  return wholeUnits + decimalUnits
}

async function sendTransaction(provider: EthereumProvider, from: string, data: string): Promise<ContractActionResult> {
  if (!isKickoffContractConfigured()) {
    return { mode: 'demo' }
  }

  const txHash = await provider.request<string>({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to: KICKOFF_MARKETS_ADDRESS,
        data,
      } satisfies TransactionRequest,
    ],
  })

  return { mode: 'onchain', txHash }
}

export async function createRoomTx(provider: EthereumProvider, from: string, market: MatchMarket) {
  const method = await selector(provider, CREATE_ROOM_SIG)
  const data = method + encodeDynamicStrings([market.sides[0].name, market.sides[1].name, market.kickoff])
  return sendTransaction(provider, from, data)
}

export async function placeTradeTx(provider: EthereumProvider, from: string, market: MatchMarket, sideIndex: number, amount: string) {
  const method = await selector(provider, PLACE_TRADE_SIG)
  const data =
    method +
    bytesToWord(roomIdFor(market)) +
    encodeUint(sideIndex) +
    encodeUint(parseUsdcAmount(amount))

  return sendTransaction(provider, from, data)
}

export async function addLiquidityTx(
  provider: EthereumProvider,
  from: string,
  market: MatchMarket,
  sideIndex: number,
  amount: string,
) {
  const method = await selector(provider, ADD_LIQUIDITY_SIG)
  const data =
    method +
    bytesToWord(roomIdFor(market)) +
    encodeUint(sideIndex) +
    encodeUint(parseUsdcAmount(amount))

  return sendTransaction(provider, from, data)
}

export async function claimTx(provider: EthereumProvider, from: string, market: MatchMarket) {
  const method = await selector(provider, CLAIM_SIG)
  const data = method + bytesToWord(roomIdFor(market))
  return sendTransaction(provider, from, data)
}
