const configuredKickoffAddress = import.meta.env.VITE_KICKOFF_MARKETS_ADDRESS?.trim() ?? ''

export const X_LAYER_MAINNET = {
  chainId: '0xc4',
  decimalChainId: 196,
  explorerTxBase: 'https://www.oklink.com/xlayer/tx',
  name: 'X Layer',
}

export const KICKOFF_MARKETS_ADDRESS = configuredKickoffAddress

export function isHexAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

export function isKickoffContractConfigured() {
  return isHexAddress(KICKOFF_MARKETS_ADDRESS) && !/^0x0{40}$/i.test(KICKOFF_MARKETS_ADDRESS)
}

export function explorerTxUrl(txHash?: string) {
  if (!txHash) return undefined
  return `${X_LAYER_MAINNET.explorerTxBase}/${txHash}`
}
