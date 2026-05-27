import { ExternalLink, X } from 'lucide-react'
import { explorerTxUrl } from '../../config/contracts'
import type { ActionStatus } from '../../types/integration'
import { LoadingMark } from './LoadingMark'

type ActionToastProps = {
  status: ActionStatus
  onDismiss: () => void
}

export function ActionToast({ status, onDismiss }: ActionToastProps) {
  if (status.state === 'idle') return null

  const txUrl = explorerTxUrl(status.txHash)

  return (
    <div className={`action-toast state-${status.state}`} role="status" aria-live={status.state === 'error' ? 'assertive' : 'polite'}>
      <div className="action-toast-copy">
        <span>
          {status.state === 'pending' ? <LoadingMark size="small" label="Transaction pending" /> : null}
          {status.state}
        </span>
        <strong>{status.message}</strong>
        {txUrl ? (
          <a href={txUrl} target="_blank" rel="noreferrer">
            View tx
            <ExternalLink size={13} strokeWidth={1.8} />
          </a>
        ) : null}
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss notification">
        <X size={15} strokeWidth={1.8} />
      </button>
    </div>
  )
}
