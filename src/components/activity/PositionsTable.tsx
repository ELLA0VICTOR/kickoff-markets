import { CheckCircle2 } from 'lucide-react'
import type { PositionRow } from '../../data/markets'
import { StatusPill } from '../ui/StatusPill'

type PositionsTableProps = {
  rows: PositionRow[]
}

export function PositionsTable({ rows }: PositionsTableProps) {
  return (
    <div className="overflow-x-auto terminal-scrollbar">
      <table className="data-table min-w-[760px]">
        <thead>
          <tr>
            <th>Market</th>
            <th>Side</th>
            <th>Size</th>
            <th>Entry</th>
            <th>Mark</th>
            <th>PNL</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.market}-${row.side}`}>
              <td className="font-mono text-[var(--value-bright)]">{row.market}</td>
              <td className="font-mono text-[var(--value)]">{row.side}</td>
              <td className="font-mono text-[var(--text-bright)]">{row.size}</td>
              <td className="font-mono text-[var(--muted)]">{row.entry}</td>
              <td className="font-mono text-[var(--value)]">{row.mark}</td>
              <td className="font-mono text-[var(--accent)]">{row.pnl}</td>
              <td>
                <StatusPill variant={row.status === 'claimable' ? 'live' : 'neutral'} dot={row.status === 'claimable'}>
                  <span className="inline-flex items-center gap-1.5">
                    {row.status === 'claimable' ? <CheckCircle2 size={12} strokeWidth={1.8} /> : null}
                    {row.status}
                  </span>
                </StatusPill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
