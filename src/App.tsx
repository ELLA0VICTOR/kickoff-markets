import { useEffect, useMemo, useState } from 'react'
import { AppTopbar } from './components/product/AppTopbar'
import { CreateRoomModal } from './components/product/CreateRoomModal'
import { Footer } from './components/product/Footer'
import { HowItWorksModal } from './components/product/HowItWorksModal'
import { type HomeTab, MarketTabs } from './components/product/MarketTabs'
import { MarketBoard } from './components/product/MarketBoard'
import { MarketPage } from './components/product/MarketPage'
import { isKickoffContractConfigured } from './config/contracts'
import { activityRows as seedActivityRows, hookSteps, markets, positions as seedPositions } from './data/markets'
import type { ActivityRow, MatchMarket, PositionRow } from './data/markets'
import { addLiquidityTx, claimTx, createRoomTx, placeTradeTx } from './lib/contractClient'
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
import type { ActionStatus } from './types/integration'

function matchesTab(market: MatchMarket, tab: HomeTab, portfolioPools: Set<string>) {
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
  const [activityList, setActivityList] = useState<ActivityRow[]>(seedActivityRows)
  const [positionList, setPositionList] = useState<PositionRow[]>(seedPositions)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<HomeTab>('All')
  const [selectedMarketId, setSelectedMarketId] = useState(markets[0].id)
  const [detailMarketId, setDetailMarketId] = useState<string>()
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)
  const [createRoomOpen, setCreateRoomOpen] = useState(false)
  const [walletSession, setWalletSession] = useState<WalletSession>()
  const [walletStatus, setWalletStatus] = useState<WalletStatus>('idle')
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)
  const [actionStatus, setActionStatus] = useState<ActionStatus>({ state: 'idle' })

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

  const portfolioPools = useMemo(() => new Set(positionList.map((position) => position.market)), [positionList])

  const filteredMarkets = useMemo(
    () => marketList.filter((market) => matchesTab(market, activeTab, portfolioPools) && matchesSearch(market, query)),
    [activeTab, marketList, portfolioPools, query],
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
    setActionStatus({ state: 'idle' })
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

  async function ensureWalletForContract() {
    if (!isKickoffContractConfigured()) return undefined

    const provider = getWalletProvider()
    if (!provider) {
      throw new Error('No injected wallet found. Install OKX Wallet or another EVM wallet.')
    }

    let session = walletSession
    if (!session) {
      session = await connectInjectedWallet(provider)
      setWalletSession(session)
      setWalletStatus('connected')
    }

    if (!isXLayer(session.chainId)) {
      await switchToXLayer(provider)
      const refreshed = await readInjectedWallet(provider)
      if (refreshed) {
        setWalletSession(refreshed)
        session = refreshed
      }
    }

    return { provider, address: session.address }
  }

  function addActivity(kind: string, market: MatchMarket, amount: string, txHash?: string, status: ActivityRow['status'] = 'confirmed') {
    const time = new Date().toISOString().slice(11, 19)
    const shortTx = txHash ? `${txHash.slice(0, 10)}...` : `local-${Date.now().toString().slice(-6)}`

    setActivityList((current) => [
      {
        time,
        kind,
        market: market.pool,
        wallet: walletSession?.address ? shortAddress(walletSession.address) : 'demo.wallet',
        amount,
        fee: `${market.hookFeeBps} bps`,
        tx: shortTx,
        status,
      },
      ...current,
    ])
  }

  function bumpMarketStats(market: MatchMarket, amount: number, sideIndex?: number, liquidity = false) {
    setMarketList((current) =>
      current.map((item) => {
        if (item.id !== market.id) return item

        const sides = item.sides.map((side, index) => {
          if (index !== sideIndex) return side

          return {
            ...side,
            liquidity: liquidity ? side.liquidity + amount : side.liquidity,
            conviction: Math.min(99, side.conviction + (liquidity ? 1 : 2)),
          }
        }) as MatchMarket['sides']

        return {
          ...item,
          liquidity: liquidity ? item.liquidity + amount : item.liquidity,
          volume: item.volume + amount,
          traders: item.traders + 1,
          xLayerTx: item.xLayerTx + 1,
          sides,
        }
      }),
    )
  }

  async function createRoom(market: MatchMarket) {
    setActionStatus({ state: 'pending', message: 'Creating match room...' })
    try {
      const wallet = await ensureWalletForContract()
      const result = wallet ? await createRoomTx(wallet.provider, wallet.address, market) : { mode: 'demo' as const }

      setMarketList((current) => [market, ...current])
      setSelectedMarketId(market.id)
      setDetailMarketId(market.id)
      setActiveTab('All')
      addActivity('ROOM', market, 'created', result.txHash)
      setActionStatus({
        state: 'success',
        mode: result.mode,
        txHash: result.txHash,
        message:
          result.mode === 'onchain'
            ? 'Room creation submitted to X Layer.'
            : 'Room created locally. Configure VITE_KICKOFF_MARKETS_ADDRESS for on-chain rooms.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Room creation failed.'
      setActionStatus({ state: 'error', message })
      if (error instanceof Error) {
        throw error
      }
      throw new Error(message, { cause: error })
    }
  }

  async function placeTrade(market: MatchMarket, sideIndex: number, amount: string) {
    setActionStatus({ state: 'pending', message: 'Preparing trade receipt...' })
    try {
      const wallet = await ensureWalletForContract()
      const result = wallet ? await placeTradeTx(wallet.provider, wallet.address, market, sideIndex, amount) : { mode: 'demo' as const }
      const numericAmount = Number(amount.replaceAll(',', '')) || 0
      const side = market.sides[sideIndex]

      bumpMarketStats(market, numericAmount, sideIndex)
      setPositionList((current) => [
        {
          market: market.pool,
          side: side.name,
          size: `$${numericAmount.toFixed(2)}`,
          entry: `$${side.price.toFixed(2)}`,
          mark: `$${side.price.toFixed(2)}`,
          pnl: '$0.00',
          status: 'open',
        },
        ...current,
      ])
      addActivity('SWAP', market, `$${numericAmount.toFixed(2)} USDC`, result.txHash)
      setActionStatus({
        state: 'success',
        mode: result.mode,
        txHash: result.txHash,
        message: result.mode === 'onchain' ? 'Trade submitted to X Layer.' : 'Demo trade recorded locally.',
      })
    } catch (error) {
      setActionStatus({ state: 'error', message: error instanceof Error ? error.message : 'Trade failed.' })
    }
  }

  async function addLiquidity(market: MatchMarket, sideIndex: number, amount: string) {
    setActionStatus({ state: 'pending', message: 'Preparing liquidity receipt...' })
    try {
      const wallet = await ensureWalletForContract()
      const result = wallet ? await addLiquidityTx(wallet.provider, wallet.address, market, sideIndex, amount) : { mode: 'demo' as const }
      const numericAmount = Number(amount.replaceAll(',', '')) || 0
      const side = market.sides[sideIndex]

      bumpMarketStats(market, numericAmount, sideIndex, true)
      setPositionList((current) => [
        {
          market: market.pool,
          side: `${side.name} LP`,
          size: `$${numericAmount.toFixed(2)}`,
          entry: `${market.hookFeeBps} bps`,
          mark: 'active',
          pnl: '$0.00',
          status: 'open',
        },
        ...current,
      ])
      addActivity('LP ADD', market, `$${numericAmount.toFixed(2)} USDC`, result.txHash)
      setActionStatus({
        state: 'success',
        mode: result.mode,
        txHash: result.txHash,
        message: result.mode === 'onchain' ? 'Liquidity submitted to X Layer.' : 'Demo liquidity recorded locally.',
      })
    } catch (error) {
      setActionStatus({ state: 'error', message: error instanceof Error ? error.message : 'Liquidity add failed.' })
    }
  }

  async function claim(market: MatchMarket) {
    setActionStatus({ state: 'pending', message: 'Preparing claim receipt...' })
    try {
      const wallet = await ensureWalletForContract()
      const result = wallet ? await claimTx(wallet.provider, wallet.address, market) : { mode: 'demo' as const }

      setPositionList((current) =>
        current.map((position) =>
          position.market === market.pool && position.status === 'claimable' ? { ...position, status: 'open' } : position,
        ),
      )
      addActivity('CLAIM', market, 'claim receipt', result.txHash)
      setActionStatus({
        state: 'success',
        mode: result.mode,
        txHash: result.txHash,
        message: result.mode === 'onchain' ? 'Claim submitted to X Layer.' : 'Demo claim recorded locally.',
      })
    } catch (error) {
      setActionStatus({ state: 'error', message: error instanceof Error ? error.message : 'Claim failed.' })
    }
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
          activityRows={activityList.filter((row) => row.market === selectedMarket.pool)}
          actionStatus={actionStatus}
          contractReady={isKickoffContractConfigured()}
          hookSteps={hookSteps}
          market={selectedMarket}
          positions={positionList.filter((position) => position.market === selectedMarket.pool)}
          onAddLiquidity={addLiquidity}
          onBack={() => setDetailMarketId(undefined)}
          onClaim={claim}
          onPlaceTrade={placeTrade}
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
