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
  chainId: '0xc4',
  chainName: 'X Layer Mainnet',
  nativeCurrency: {
    name: 'OKB',
    symbol: 'OKB',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.xlayer.tech'],
  blockExplorerUrls: ['https://www.oklink.com/xlayer'],
}

export function getWalletProvider() {
  if (typeof window === 'undefined') return undefined

  const walletWindow = window as WalletWindow
  return walletWindow.okxwallet || walletWindow.ethereum
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function isXLayer(chainId?: string) {
  return chainId?.toLowerCase() === X_LAYER_CHAIN.chainId
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
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: X_LAYER_CHAIN.chainId }],
    })
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && Number(error.code) === 4902) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [X_LAYER_CHAIN],
      })
      return
    }

    throw error
  }
}
