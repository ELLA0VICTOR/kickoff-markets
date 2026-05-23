import type { ReactNode } from 'react'
import { TopNav } from './TopNav'

type TerminalShellProps = {
  children: ReactNode
}

export function TerminalShell({ children }: TerminalShellProps) {
  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <TopNav />
      <main id="top" className="terminal-container pb-10 pt-7">
        {children}
      </main>
    </div>
  )
}
