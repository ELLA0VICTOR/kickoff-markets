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
  isOkxWallet?: boolean
  isOKExWallet?: boolean
  isMetaMask?: boolean
  providers?: EthereumProvider[]
  on?(event: 'accountsChanged' | 'chainChanged', handler: (...args: unknown[]) => void): void
  removeListener?(event: 'accountsChanged' | 'chainChanged', handler: (...args: unknown[]) => void): void
}

type WalletNamespace = EthereumProvider & {
  ethereum?: EthereumProvider
}

type WalletWindow = Window &
  typeof globalThis & {
    ethereum?: EthereumProvider
    okxwallet?: WalletNamespace
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

const X_LAYER_ADD_CHAIN = {
  ...X_LAYER_CHAIN,
  rpcUrls: [X_LAYER_NETWORK.rpcUrls[0]],
  blockExplorerUrls: [X_LAYER_NETWORK.blockExplorerUrls[0]],
}

const X_LAYER_SWITCH_MESSAGE = `OKX Wallet did not complete the ${X_LAYER_NETWORK.name} switch. In the OKX Connect panel, open the Ethereum network dropdown and choose ${X_LAYER_NETWORK.name}.`

function isProvider(value: unknown): value is EthereumProvider {
  return typeof value === 'object' && value !== null && 'request' in value && typeof value.request === 'function'
}

function uniqueProviders(providers: Array<EthereumProvider | undefined>) {
  return providers.filter((provider, index): provider is EthereumProvider => Boolean(provider) && providers.indexOf(provider) === index)
}

function walletProviderCandidates() {
  if (typeof window === 'undefined') return []

  const walletWindow = window as WalletWindow
  const ethereumProviders = walletWindow.ethereum?.providers ?? []
  const okxEthereum = walletWindow.okxwallet?.ethereum
  const okxWallet = isProvider(walletWindow.okxwallet) ? walletWindow.okxwallet : undefined

  return uniqueProviders([
    okxEthereum,
    okxWallet,
    ...ethereumProviders.filter(isOkxProvider),
    walletWindow.ethereum,
    ...ethereumProviders,
  ])
}

export function getWalletProvider() {
  return walletProviderCandidates()[0]
}

function isOkxProvider(provider: EthereumProvider) {
  if (typeof window === 'undefined') return false

  const walletWindow = window as WalletWindow
  return walletWindow.okxwallet === provider || walletWindow.okxwallet?.ethereum === provider || Boolean(provider.isOkxWallet || provider.isOKExWallet)
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

async function switchProviderToXLayer(provider: EthereumProvider) {
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: X_LAYER_CHAIN.chainId }],
    })
  } catch (error) {
    if (typeof error === 'object' && error && 'code' in error && Number(error.code) === 4902) {
      if (isOkxProvider(provider)) {
        throw new Error(X_LAYER_SWITCH_MESSAGE, { cause: error })
      }

      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [X_LAYER_ADD_CHAIN],
        })
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: X_LAYER_CHAIN.chainId }],
        })
        return
      } catch (addError) {
        throw new Error(X_LAYER_SWITCH_MESSAGE, { cause: addError })
      }
    }

    throw error
  }
}

export async function switchToXLayer(provider: EthereumProvider) {
  const errors: unknown[] = []
  const providers = uniqueProviders([provider, ...walletProviderCandidates()])

  for (const candidate of providers) {
    try {
      await switchProviderToXLayer(candidate)
      const chainId = await candidate.request<string>({ method: 'eth_chainId' })
      if (isXLayer(chainId)) return candidate
    } catch (error) {
      errors.push(error)
    }
  }

  throw new Error(X_LAYER_SWITCH_MESSAGE, { cause: errors[0] })
}
