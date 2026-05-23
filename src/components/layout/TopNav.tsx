import { Activity, BarChart3, CircleDollarSign, Code2, ExternalLink, Wallet } from 'lucide-react'
import { StatusPill } from '../ui/StatusPill'

const navItems = [
  { key: 'M)', label: 'Markets', href: '#markets', icon: BarChart3 },
  { key: 'H)', label: 'Hook', href: '#hook', icon: Code2 },
  { key: 'L)', label: 'Liquidity', href: '#liquidity', icon: CircleDollarSign },
  { key: 'A)', label: 'Activity', href: '#activity', icon: Activity },
]

export function TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b-2 border-[var(--header-bg)] bg-[var(--bg-darker)] font-mono">
      <div className="terminal-container flex min-h-14 items-stretch overflow-x-auto p-0">
        <a
          href="#top"
          className="flex shrink-0 items-center gap-2 bg-[var(--header-bg)] px-4 text-[13px] font-bold text-[var(--text-bright)]"
        >
          <span className="text-[var(--label)]">KICKOFF</span>
          <span>Markets</span>
        </a>

        <nav className="flex min-w-max">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <a
                className="flex items-center gap-2 border-r border-[var(--border)] px-4 text-[12px] text-[var(--text)] transition hover:bg-[var(--panel-2)]"
                href={item.href}
                key={item.label}
              >
                <Icon size={14} strokeWidth={1.8} />
                <span className="text-[var(--label)]">{item.key}</span>
                {item.label}
              </a>
            )
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3 px-3">
          <StatusPill variant="live" dot>
            X Layer 196
          </StatusPill>
          <button className="terminal-button" type="button">
            <Wallet size={15} strokeWidth={1.8} />
            0x8b65...b669
          </button>
          <a className="terminal-icon-link" href="https://web3.okx.com/xlayer" target="_blank" rel="noreferrer" aria-label="Open X Layer">
            <ExternalLink size={15} strokeWidth={1.8} />
          </a>
        </div>
      </div>
    </header>
  )
}
