const configuredKickoffAddress = import.meta.env.VITE_KICKOFF_MARKETS_ADDRESS?.trim() ?? ''
const configuredCollateralAddress = import.meta.env.VITE_COLLATERAL_TOKEN_ADDRESS?.trim() ?? ''
const configuredMatchClockHookAddress = import.meta.env.VITE_MATCH_CLOCK_HOOK_ADDRESS?.trim() ?? ''
const configuredMatchOracleAgentAddress = import.meta.env.VITE_MATCH_ORACLE_AGENT_ADDRESS?.trim() ?? ''
const configuredRpcUrl = import.meta.env.VITE_X_LAYER_RPC_URL?.trim() ?? ''

export type XLayerNetworkId = 'mainnet' | 'testnet'

type XLayerNetworkConfig = {
  id: XLayerNetworkId
  name: string
  chainId: string
  decimalChainId: number
  rpcUrls: string[]
  blockExplorerUrls: string[]
  explorerTxBase: string
  faucetUrl?: string
}

export const X_LAYER_NETWORKS = {
  mainnet: {
    id: 'mainnet',
    name: 'X Layer Mainnet',
    chainId: '0xc4',
    decimalChainId: 196,
    rpcUrls: ['https://rpc.xlayer.tech', 'https://xlayerrpc.okx.com'],
    blockExplorerUrls: ['https://www.okx.com/web3/explorer/xlayer'],
    explorerTxBase: 'https://www.okx.com/web3/explorer/xlayer/tx',
  },
  testnet: {
    id: 'testnet',
    name: 'X Layer Testnet',
    chainId: '0x7a0',
    decimalChainId: 1952,
    rpcUrls: ['https://testrpc.xlayer.tech', 'https://testrpc.xlayer.tech/terigon', 'https://xlayertestrpc.okx.com/terigon'],
    blockExplorerUrls: ['https://www.oklink.com/xlayer-test'],
    explorerTxBase: 'https://www.oklink.com/xlayer-test/tx',
    faucetUrl: 'https://web3.okx.com/xlayer/faucet',
  },
} satisfies Record<XLayerNetworkId, XLayerNetworkConfig>

function resolveConfiguredNetwork(): XLayerNetworkId {
  return import.meta.env.VITE_X_LAYER_NETWORK?.trim().toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet'
}

export const X_LAYER_NETWORK = X_LAYER_NETWORKS[resolveConfiguredNetwork()]
export const X_LAYER_RPC_URLS = Array.from(new Set([configuredRpcUrl, ...X_LAYER_NETWORK.rpcUrls].filter(Boolean)))

export const KICKOFF_MARKETS_ADDRESS = configuredKickoffAddress
export const COLLATERAL_TOKEN_ADDRESS = configuredCollateralAddress
export const MATCH_CLOCK_HOOK_ADDRESS = configuredMatchClockHookAddress
export const MATCH_ORACLE_AGENT_ADDRESS = configuredMatchOracleAgentAddress

export function isHexAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function isKickoffContractConfigured() {
  return isHexAddress(KICKOFF_MARKETS_ADDRESS) && !/^0x0{40}$/i.test(KICKOFF_MARKETS_ADDRESS)
}

export function isCollateralTokenConfigured() {
  return isHexAddress(COLLATERAL_TOKEN_ADDRESS) && !/^0x0{40}$/i.test(COLLATERAL_TOKEN_ADDRESS)
}

export function explorerTxUrl(txHash?: string) {
  if (!txHash) return undefined
  return `${X_LAYER_NETWORK.explorerTxBase}/${txHash}`
}
