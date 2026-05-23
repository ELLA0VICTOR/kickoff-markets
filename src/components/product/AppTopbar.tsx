import { HelpCircle, Search, Wallet } from 'lucide-react'
import type { WalletStatus } from '../../lib/wallet'
import { KickoffMark } from './KickoffMark'

type AppTopbarProps = {
  query: string
  walletAddress?: string
  walletLabel: string
  walletStatus: WalletStatus
  walletMenuOpen: boolean
  isXLayer: boolean
  onQueryChange: (query: string) => void
  onHowItWorks: () => void
  onWalletConnect: () => void
  onWalletMenuToggle: () => void
  onWalletDisconnect: () => void
  onWalletCopy: () => void
  onSwitchNetwork: () => void
}

export function AppTopbar({
  query,
  walletAddress,
  walletLabel,
  walletStatus,
  walletMenuOpen,
  isXLayer,
  onQueryChange,
  onHowItWorks,
  onWalletConnect,
  onWalletMenuToggle,
  onWalletDisconnect,
  onWalletCopy,
  onSwitchNetwork,
}: AppTopbarProps) {
  return (
    <header className="app-topbar">
      <a className="brand" href="#" aria-label="Kickoff Markets home">
        <KickoffMark />
        <span>Kickoff</span>
      </a>

      <label className="search-box" htmlFor="market-search">
        <Search size={21} strokeWidth={1.8} />
        <input
          id="market-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search matches..."
        />
      </label>

      <div className="topbar-actions">
        <button className="link-button" type="button" onClick={onHowItWorks}>
          <HelpCircle size={17} strokeWidth={1.8} />
          <span className="wide-label">How it works?</span>
        </button>
        <button className={isXLayer ? 'network-chip is-active' : 'network-chip'} type="button" onClick={onSwitchNetwork}>
          {isXLayer ? 'X Layer' : 'Switch X Layer'}
        </button>
        <button
          className="wallet-button"
          type="button"
          onClick={walletAddress ? onWalletMenuToggle : onWalletConnect}
          disabled={walletStatus === 'connecting'}
          aria-expanded={walletAddress ? walletMenuOpen : undefined}
        >
          <Wallet size={17} strokeWidth={1.8} />
          <span className="wide-label">{walletStatus === 'connecting' ? 'Connecting' : walletLabel}</span>
          <span className="short-label">{walletAddress ? walletLabel : 'Connect'}</span>
        </button>
        {walletMenuOpen && walletAddress ? (
          <div className="wallet-menu">
            <div className="wallet-menu-heading">
              <span>Connected wallet</span>
              <strong>{walletLabel}</strong>
            </div>
            <button type="button" onClick={onWalletCopy}>
              Copy address
            </button>
            <button type="button" onClick={onSwitchNetwork}>
              Switch to X Layer
            </button>
            <button type="button" onClick={onWalletDisconnect}>
              Disconnect
            </button>
          </div>
        ) : null}
      </div>
    </header>
  )
}
