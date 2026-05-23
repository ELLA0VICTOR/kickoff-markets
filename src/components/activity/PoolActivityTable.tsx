import { ExternalLink } from 'lucide-react'
import type { ActivityRow } from '../../data/markets'
import { StatusPill } from '../ui/StatusPill'

type PoolActivityTableProps = {
  rows: ActivityRow[]
}

export function PoolActivityTable({ rows }: PoolActivityTableProps) {
  return (
    <div className="overflow-x-auto terminal-scrollbar" id="activity">
      <table className="data-table min-w-[860px]">
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Market</th>
            <th>Wallet</th>
            <th>Amount</th>
            <th>Hook Fee</th>
            <th>Tx</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.time}-${row.tx}`}>
              <td className="font-mono text-[var(--muted)]">{row.time}</td>
              <td className="font-mono text-[var(--label)]">{row.kind}</td>
              <td className="font-mono text-[var(--value-bright)]">{row.market}</td>
              <td className="font-mono text-[var(--value)]">{row.wallet}</td>
              <td className="font-mono text-[var(--text-bright)]">{row.amount}</td>
              <td className="font-mono text-[var(--label)]">{row.fee}</td>
              <td>
                <a className="inline-flex items-center gap-1.5 font-mono text-[var(--value)]" href="#top">
                  {row.tx}
                  <ExternalLink size={12} strokeWidth={1.8} />
                </a>
              </td>
              <td>
                <StatusPill variant={row.status === 'confirmed' ? 'success' : 'warn'}>
                  {row.status}
                </StatusPill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
