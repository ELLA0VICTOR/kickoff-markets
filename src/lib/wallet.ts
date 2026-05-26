import { X_LAYER_NETWORK } from '../config/contracts'

export type WalletStatus = 'idle' | 'connecting' | 'connected'

export type WalletSession = {
  address: string
  chainId?: string
}

type ProviderRequestArgs = {
  method: string
  params?: unknown[]
}

export type EthereumProvider = {
  request<T = unknown>(args: ProviderRequestArgs): Promise<T>
  on?(event: 'accountsChanged' | 'chainChanged', handler: (...args: unknown[]) => void): void
  removeListener?(event: 'accountsChanged' | 'chainChanged', handler: (...args: unknown[]) => void): void
}

type WalletWindow = Window &
  typeof globalThis & {
    ethereum?: EthereumProvider
    okxwallet?: EthereumProvider
  }

const X_LAYER_CHAIN = {
  chainId: X_LAYER_NETWORK.chainId,
  chainName: X_LAYER_NETWORK.name,
  nativeCurrency: {
    name: 'OKB',
    symbol: 'OKB',
    decimals: 18,
  },
  rpcUrls: X_LAYER_NETWORK.rpcUrls,
  blockExplorerUrls: X_LAYER_NETWORK.blockExplorerUrls,
}

const X_LAYER_MANUAL_SWITCH_MESSAGE =
  `Open OKX Wallet and switch to the built-in ${X_LAYER_NETWORK.name}. Do not use a custom RPC entry; OKX may reject transactions on custom X Layer networks.`

export function getWalletProvider() {
  if (typeof window === 'undefined') return undefined

  const walletWindow = window as WalletWindow
  return walletWindow.okxwallet || walletWindow.ethereum
}

function isOkxProvider(provider: EthereumProvider) {
  if (typeof window === 'undefined') return false

  const walletWindow = window as WalletWindow
  return walletWindow.okxwallet === provider
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function isXLayer(chainId?: string) {
  return chainId?.toLowerCase() === X_LAYER_CHAIN.chainId.toLowerCase()
}

export async function connectInjectedWallet(provider: EthereumProvider): Promise<WalletSession> {
  const accounts = await provider.request<string[]>({ method: 'eth_requestAccounts' })
  const chainId = await provider.request<string>({ method: 'eth_chainId' })
  const address = accounts[0]

  if (!address) {
    throw new Error('No account returned by wallet.')
  }

  return { address, chainId }
}

export async function readInjectedWallet(provider: EthereumProvider): Promise<WalletSession | undefined> {
  const accounts = await provider.request<string[]>({ method: 'eth_accounts' })
  const address = accounts[0]

  if (!address) {
    return undefined
  }

  const chainId = await provider.request<string>({ method: 'eth_chainId' })
  return { address, chainId }
}

export async function switchToXLayer(provider: EthereumProvider) {
  if (isOkxProvider(provider)) {
    throw new Error(X_LAYER_MANUAL_SWITCH_MESSAGE)
  }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: X_LAYER_CHAIN.chainId }],
    })
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && Number(error.code) === 4902) {
      throw new Error(X_LAYER_MANUAL_SWITCH_MESSAGE)
    }

    throw error
  }
}
