import { HelpCircle, Search, Wallet } from 'lucide-react'
import { KickoffMark } from './KickoffMark'

type AppTopbarProps = {
  query: string
  onQueryChange: (query: string) => void
}

export function AppTopbar({ query, onQueryChange }: AppTopbarProps) {
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
        <button className="link-button" type="button">
          <HelpCircle size={17} strokeWidth={1.8} />
          <span className="wide-label">How it works?</span>
        </button>
        <div className="network-chip">X Layer</div>
        <button className="wallet-button" type="button">
          <Wallet size={17} strokeWidth={1.8} />
          <span className="wide-label">Connect wallet</span>
          <span className="short-label">Connect</span>
        </button>
      </div>
    </header>
  )
}
