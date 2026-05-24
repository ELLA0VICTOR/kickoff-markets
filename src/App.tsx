import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppTopbar } from './components/product/AppTopbar'
import { CreateRoomModal } from './components/product/CreateRoomModal'
import { Footer } from './components/product/Footer'
import { HowItWorksModal } from './components/product/HowItWorksModal'
import { MarketBoard } from './components/product/MarketBoard'
import { MarketPage } from './components/product/MarketPage'
import { type HomeTab, MarketTabs } from './components/product/MarketTabs'
import { isCollateralTokenConfigured, isKickoffContractConfigured } from './config/contracts'
import { hookSteps } from './data/markets'
import type { ActivityRow, FinalMarketSettlement, MarketPhase, MatchMarket, PositionRow, RoomDraft } from './data/markets'
import {
  addLiquidityTx,
  claimTx,
  createRoomTx,
  disputeSettlementTx,
  faucetCollateralTx,
  finalizeSettlementTx,
  loadOnchainState,
  placeTradeTx,
  proposeSettlementTx,
  readCollateralBalance,
  resolveDisputeTx,
  updatePhaseTx,
  type OnchainState,
} from './lib/contractClient'
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

function actionMessage(action: string, approvalHash?: string) {
  return approvalHash ? `Approval confirmed. ${action} submitted to X Layer.` : `${action} submitted to X Layer.`
}

function App() {
  const [marketList, setMarketList] = useState<MatchMarket[]>([])
  const [activityList, setActivityList] = useState<ActivityRow[]>([])
  const [positionList, setPositionList] = useState<PositionRow[]>([])
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<HomeTab>('All')
  const [selectedMarketId, setSelectedMarketId] = useState<string>()
  const [detailMarketId, setDetailMarketId] = useState<string>()
  const [howItWorksOpen, setHowItWorksOpen] = useState(false)
  const [createRoomOpen, setCreateRoomOpen] = useState(false)
  const [walletSession, setWalletSession] = useState<WalletSession>()
  const [walletStatus, setWalletStatus] = useState<WalletStatus>('idle')
  const [walletMenuOpen, setWalletMenuOpen] = useState(false)
  const [actionStatus, setActionStatus] = useState<ActionStatus>({ state: 'idle' })
  const [collateralBalance, setCollateralBalance] = useState<number>()
  const [loadingState, setLoadingState] = useState(false)
  const [loadError, setLoadError] = useState<string>()

  const contractReady = isKickoffContractConfigured() && isCollateralTokenConfigured()
  const walletAddress = walletSession?.address

  const refreshOnchainState = useCallback(async (): Promise<OnchainState | undefined> => {
    if (!isKickoffContractConfigured()) {
      setMarketList([])
      setActivityList([])
      setPositionList([])
      setLoadError('Deploy KickoffMarkets and set VITE_KICKOFF_MARKETS_ADDRESS.')
      return undefined
    }

    setLoadingState(true)
    try {
      const state = await loadOnchainState(walletAddress)
      setMarketList(state.markets)
      setActivityList(state.activityRows)
      setPositionList(state.positions)
      setLoadError(undefined)
      setSelectedMarketId((current) => (current && state.markets.some((market) => market.id === current) ? current : state.markets[0]?.id))

      if (walletAddress && isCollateralTokenConfigured()) {
        setCollateralBalance(await readCollateralBalance(walletAddress))
      } else {
        setCollateralBalance(undefined)
      }

      return state
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to read X Layer state.'
      setLoadError(message)
      return undefined
    } finally {
      setLoadingState(false)
    }
  }, [walletAddress])

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
    const timer = window.setTimeout(() => {
      void refreshOnchainState()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [refreshOnchainState])

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
    () => marketList.find((market) => market.id === (detailMarketId || selectedMarketId)),
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
    if (!isKickoffContractConfigured()) {
      throw new Error('Deploy KickoffMarkets and set VITE_KICKOFF_MARKETS_ADDRESS first.')
    }

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

  async function claimCollateral() {
    setActionStatus({ state: 'pending', message: 'Claiming test collateral...' })
    try {
      const wallet = await ensureWalletForContract()
      const result = await faucetCollateralTx(wallet.provider, wallet.address)
      await refreshOnchainState()
      setActionStatus({
        state: 'success',
        mode: 'onchain',
        txHash: result.txHash,
        message: 'Test collateral claimed on X Layer.',
      })
    } catch (error) {
      setActionStatus({ state: 'error', message: error instanceof Error ? error.message : 'Collateral faucet failed.' })
    }
  }

  async function createRoom(draft: RoomDraft) {
    setActionStatus({ state: 'pending', message: 'Creating match room on X Layer...' })
    try {
      const wallet = await ensureWalletForContract()
      const result = await createRoomTx(wallet.provider, wallet.address, draft)
      const state = await refreshOnchainState()
      const createdMarket = state?.markets[0]

      if (createdMarket) {
        setSelectedMarketId(createdMarket.id)
        setDetailMarketId(createdMarket.id)
      }

      setActiveTab('All')
      setActionStatus({
        state: 'success',
        mode: 'onchain',
        txHash: result.txHash,
        message: 'Room created on X Layer.',
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Room creation failed.'
      setActionStatus({ state: 'error', message })
      if (error instanceof Error) throw error
      throw new Error(message, { cause: error })
    }
  }

  async function placeTrade(market: MatchMarket, sideIndex: number, amount: string) {
    setActionStatus({ state: 'pending', message: 'Approve collateral, then confirm the trade.' })
    try {
      const wallet = await ensureWalletForContract()
      const result = await placeTradeTx(wallet.provider, wallet.address, market, sideIndex, amount)
      await refreshOnchainState()
      setActionStatus({
        state: 'success',
        mode: 'onchain',
        txHash: result.txHash,
        message: actionMessage('Trade', result.approvalHash),
      })
    } catch (error) {
      setActionStatus({ state: 'error', message: error instanceof Error ? error.message : 'Trade failed.' })
    }
  }

  async function addLiquidity(market: MatchMarket, sideIndex: number, amount: string) {
    setActionStatus({ state: 'pending', message: 'Approve collateral, then confirm the liquidity add.' })
    try {
      const wallet = await ensureWalletForContract()
      const result = await addLiquidityTx(wallet.provider, wallet.address, market, sideIndex, amount)
      await refreshOnchainState()
      setActionStatus({
        state: 'success',
        mode: 'onchain',
        txHash: result.txHash,
        message: actionMessage('Liquidity', result.approvalHash),
      })
    } catch (error) {
      setActionStatus({ state: 'error', message: error instanceof Error ? error.message : 'Liquidity add failed.' })
    }
  }

  async function updatePhase(market: MatchMarket, phase: MarketPhase, clock: string, score: string, feeBps: number) {
    setActionStatus({ state: 'pending', message: 'Updating Match Clock fee state...' })
    try {
      const wallet = await ensureWalletForContract()
      const result = await updatePhaseTx(wallet.provider, wallet.address, market, phase, clock, score, feeBps)
      await refreshOnchainState()
      setActionStatus({
        state: 'success',
        mode: 'onchain',
        txHash: result.txHash,
        message: 'Match Clock state updated on X Layer.',
      })
    } catch (error) {
      setActionStatus({ state: 'error', message: error instanceof Error ? error.message : 'Clock update failed.' })
    }
  }

  async function proposeSettlement(market: MatchMarket, outcome: FinalMarketSettlement, score: string, clock: string) {
    setActionStatus({ state: 'pending', message: 'Proposing settlement on X Layer...' })
    try {
      const wallet = await ensureWalletForContract()
      const result = await proposeSettlementTx(wallet.provider, wallet.address, market, outcome, score, clock)
      await refreshOnchainState()
      setActionStatus({
        state: 'success',
        mode: 'onchain',
        txHash: result.txHash,
        message: 'Settlement proposed. Dispute window is open.',
      })
    } catch (error) {
      setActionStatus({ state: 'error', message: error instanceof Error ? error.message : 'Settlement proposal failed.' })
    }
  }

  async function disputeSettlement(market: MatchMarket) {
    setActionStatus({ state: 'pending', message: 'Opening settlement dispute...' })
    try {
      const wallet = await ensureWalletForContract()
      const result = await disputeSettlementTx(wallet.provider, wallet.address, market, 'Disputed from Kickoff Markets UI.')
      await refreshOnchainState()
      setActionStatus({
        state: 'success',
        mode: 'onchain',
        txHash: result.txHash,
        message: 'Settlement disputed. Resolver action is required.',
      })
    } catch (error) {
      setActionStatus({ state: 'error', message: error instanceof Error ? error.message : 'Dispute failed.' })
    }
  }

  async function finalizeSettlement(market: MatchMarket) {
    setActionStatus({ state: 'pending', message: 'Finalizing settlement...' })
    try {
      const wallet = await ensureWalletForContract()
      const result = await finalizeSettlementTx(wallet.provider, wallet.address, market)
      await refreshOnchainState()
      setActionStatus({
        state: 'success',
        mode: 'onchain',
        txHash: result.txHash,
        message: 'Settlement finalized. Claims are now available.',
      })
    } catch (error) {
      setActionStatus({ state: 'error', message: error instanceof Error ? error.message : 'Finalize failed.' })
    }
  }

  async function resolveDispute(market: MatchMarket, outcome: FinalMarketSettlement, score: string, clock: string) {
    setActionStatus({ state: 'pending', message: 'Resolving dispute...' })
    try {
      const wallet = await ensureWalletForContract()
      const result = await resolveDisputeTx(wallet.provider, wallet.address, market, outcome, score, clock)
      await refreshOnchainState()
      setActionStatus({
        state: 'success',
        mode: 'onchain',
        txHash: result.txHash,
        message: 'Dispute resolved. Claims are now available.',
      })
    } catch (error) {
      setActionStatus({ state: 'error', message: error instanceof Error ? error.message : 'Dispute resolution failed.' })
    }
  }

  async function claim(market: MatchMarket) {
    setActionStatus({ state: 'pending', message: 'Claiming escrow payout...' })
    try {
      const wallet = await ensureWalletForContract()
      const result = await claimTx(wallet.provider, wallet.address, market)
      await refreshOnchainState()
      setActionStatus({
        state: 'success',
        mode: 'onchain',
        txHash: result.txHash,
        message: 'Claim paid from escrow.',
      })
    } catch (error) {
      setActionStatus({ state: 'error', message: error instanceof Error ? error.message : 'Claim failed.' })
    }
  }

  const board = (
    <>
      <MarketTabs activeTab={activeTab} onTabChange={setActiveTab} />
      <MarketBoard
        collateralBalance={collateralBalance}
        contractReady={contractReady}
        loading={loadingState}
        loadError={loadError}
        markets={filteredMarkets}
        selectedMarketId={selectedMarketId}
        onCreateClick={() => setCreateRoomOpen(true)}
        onFaucetClick={claimCollateral}
        onMarketSelect={selectMarket}
      />
    </>
  )

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

      {detailMarketId && selectedMarket ? (
        <MarketPage
          activityRows={activityList.filter((row) => row.market === selectedMarket.pool)}
          actionStatus={actionStatus}
          contractReady={contractReady}
          hookSteps={hookSteps}
          market={selectedMarket}
          positions={positionList.filter((position) => position.market === selectedMarket.pool)}
          walletAddress={walletSession?.address}
          onAddLiquidity={addLiquidity}
          onBack={() => setDetailMarketId(undefined)}
          onClaim={claim}
          onDispute={disputeSettlement}
          onFinalize={finalizeSettlement}
          onPlaceTrade={placeTrade}
          onResolveDispute={resolveDispute}
          onSettle={proposeSettlement}
          onUpdatePhase={updatePhase}
        />
      ) : (
        board
      )}

      <Footer onCreateRoom={() => setCreateRoomOpen(true)} onHowItWorks={() => setHowItWorksOpen(true)} />
    </div>
  )
}

export default App
