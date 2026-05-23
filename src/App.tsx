import { useEffect, useMemo, useState } from 'react'
import { AppTopbar } from './components/product/AppTopbar'
import { CreateRoomModal } from './components/product/CreateRoomModal'
import { Footer } from './components/product/Footer'
import { HowItWorksModal } from './components/product/HowItWorksModal'
import { type HomeTab, MarketTabs } from './components/product/MarketTabs'
import { MarketBoard } from './components/product/MarketBoard'
import { MarketPage } from './components/product/MarketPage'
import { activityRows, hookSteps, markets, positions } from './data/markets'
import type { MatchMarket } from './data/markets'
import {
  connectInjectedWallet,
  getWalletProvider,
  isXLayer,
  readInjectedWallet,
  shortAddress,
  switchToXLayer,
  type WalletSession,
  type WalletStatus,
} from './lib/wallet'

const portfolioPools = new Set(positions.map((position) => position.market))

function matchesTab(market: MatchMarket, tab: HomeTab) {
  if (tab === 'All') return true
  if (tab === 'Live') return market.status === 'live'
  if (tab === 'Upcoming') return market.status === 'open'
  if (tab === 'Settling') return market.status === 'settling'
  if (tab === 'Portfolio') return portfolioPools.has(market.pool)

  return false
}

function matchesSearch(market: MatchMarket, query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true

  return [market.sides[0].name, market.sides[1].name, market.sides[0].code, market.sides[1].code, market.stage, market.pool]
    .join(' ')
    .toLowerCase()
    .includes(normalized)
}

function App() {
  const [marketList, setMarketList] = useState<MatchMarket[]>(markets)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<HomeTab>('All')
  const [selectedMarketId, setSelectedMarketId] = useState(markets[0].id)
  const [detailMarketId, setDetailMarketId] = useState<string>()
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)
  const [createRoomOpen, setCreateRoomOpen] = useState(false)
  const [walletSession, setWalletSession] = useState<WalletSession>()
  const [walletStatus, setWalletStatus] = useState<WalletStatus>('idle')
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)

  useEffect(() => {
    const provider = getWalletProvider()
    if (!provider) return

    readInjectedWallet(provider)
      .then((session) => {
        if (session) {
          setWalletSession(session)
          setWalletStatus('connected')
        }
      })
      .catch(() => undefined)

    const onAccountsChanged = (...args: unknown[]) => {
      const accounts = Array.isArray(args[0]) ? (args[0] as string[]) : []
      const address = accounts[0]

      if (!address) {
        setWalletSession(undefined)
        setWalletStatus('idle')
        setWalletMenuOpen(false)
        return
      }

      setWalletSession((current) => ({ address, chainId: current?.chainId }))
      setWalletStatus('connected')
    }

    const onChainChanged = (...args: unknown[]) => {
      const chainId = typeof args[0] === 'string' ? args[0] : undefined
      setWalletSession((current) => (current ? { ...current, chainId } : current))
    }

    provider.on?.('accountsChanged', onAccountsChanged)
    provider.on?.('chainChanged', onChainChanged)

    return () => {
      provider.removeListener?.('accountsChanged', onAccountsChanged)
      provider.removeListener?.('chainChanged', onChainChanged)
    }
  }, [])

  useEffect(() => {
    if (!walletMenuOpen) return

    const closeMenu = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.topbar-actions')) {
        return
      }

      setWalletMenuOpen(false)
    }

    window.addEventListener('pointerdown', closeMenu)
    return () => window.removeEventListener('pointerdown', closeMenu)
  }, [walletMenuOpen])

  const filteredMarkets = useMemo(
    () => marketList.filter((market) => matchesTab(market, activeTab) && matchesSearch(market, query)),
    [activeTab, marketList, query],
  )

  const selectedMarket = useMemo(
    () => marketList.find((market) => market.id === (detailMarketId || selectedMarketId)) ?? marketList[0],
    [detailMarketId, marketList, selectedMarketId],
  )

  const walletLabel =
    walletStatus === 'connecting'
      ? 'Connecting'
      : walletSession?.address
        ? shortAddress(walletSession.address)
        : 'Connect wallet'

  function selectMarket(id: string) {
    setSelectedMarketId(id)
    setDetailMarketId(id)
  }

  async function connectWallet() {
    const provider = getWalletProvider()

    if (!provider) {
      window.alert('No injected wallet found. Install OKX Wallet or another EVM wallet to connect.')
      return
    }

    setWalletStatus('connecting')
    try {
      const session = await connectInjectedWallet(provider)
      setWalletSession(session)
      setWalletStatus('connected')
      setWalletMenuOpen(false)
    } catch (error) {
      setWalletStatus(walletSession ? 'connected' : 'idle')
      window.alert(error instanceof Error ? error.message : 'Wallet connection failed.')
    }
  }

  async function switchNetwork() {
    const provider = getWalletProvider()

    if (!provider) {
      window.alert('No injected wallet found. Install OKX Wallet or another EVM wallet to switch networks.')
      return
    }

    try {
      await switchToXLayer(provider)
      const session = await readInjectedWallet(provider)
      if (session) {
        setWalletSession(session)
        setWalletStatus('connected')
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Network switch failed.')
    }
  }

  async function copyWalletAddress() {
    if (!walletSession?.address) return

    try {
      await navigator.clipboard.writeText(walletSession.address)
      setWalletMenuOpen(false)
    } catch {
      window.alert(walletSession.address)
    }
  }

  function disconnectWallet() {
    setWalletSession(undefined)
    setWalletStatus('idle')
    setWalletMenuOpen(false)
  }

  function createRoom(market: MatchMarket) {
    setMarketList((current) => [market, ...current])
    setSelectedMarketId(market.id)
    setDetailMarketId(market.id)
    setActiveTab('All')
  }

  return (
    <div className="app-shell">
      <HowItWorksModal open={howItWorksOpen} onClose={() => setHowItWorksOpen(false)} />
      <CreateRoomModal open={createRoomOpen} onClose={() => setCreateRoomOpen(false)} onCreate={createRoom} />
      <AppTopbar
        isXLayer={isXLayer(walletSession?.chainId)}
        query={query}
        walletAddress={walletSession?.address}
        walletLabel={walletLabel}
        walletMenuOpen={walletMenuOpen}
        walletStatus={walletStatus}
        onHowItWorks={() => setHowItWorksOpen(true)}
        onQueryChange={setQuery}
        onSwitchNetwork={switchNetwork}
        onWalletConnect={connectWallet}
        onWalletCopy={copyWalletAddress}
        onWalletDisconnect={disconnectWallet}
        onWalletMenuToggle={() => setWalletMenuOpen((open) => !open)}
      />

      {detailMarketId ? (
        <MarketPage
          activityRows={activityRows}
          hookSteps={hookSteps}
          market={selectedMarket}
          positions={positions}
          onBack={() => setDetailMarketId(undefined)}
        />
      ) : (
        <>
          <MarketTabs activeTab={activeTab} onTabChange={setActiveTab} />
          <MarketBoard
            markets={filteredMarkets}
            selectedMarketId={selectedMarketId}
            onCreateClick={() => setCreateRoomOpen(true)}
            onMarketSelect={selectMarket}
          />
        </>
      )}

      <Footer onCreateRoom={() => setCreateRoomOpen(true)} onHowItWorks={() => setHowItWorksOpen(true)} />
    </div>
  )
}

export default App
