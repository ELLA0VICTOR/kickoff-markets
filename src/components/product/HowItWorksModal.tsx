import { useEffect, useState } from 'react'
import { KickoffMark } from './KickoffMark'

type HowItWorksModalProps = {
  open: boolean
  onClose: () => void
}

const steps = [
  {
    kicker: 'Match rooms',
    title: 'Pick a live fixture',
    body: 'Start from the match board. Each card is a tradable room with two team sides, live prices, liquidity, and a visible match clock.',
    signal: 'Room open',
    metric: 'ARG/FRA',
  },
  {
    kicker: 'Trading',
    title: 'Buy a side or add liquidity',
    body: 'Choose a team, enter USDC, and route the order through the match pool. LPs can support either room and earn from live flow.',
    signal: 'Trade ready',
    metric: '$0.52',
  },
  {
    kicker: 'Match Clock Hook',
    title: 'Fees react to the game',
    body: 'The Hook changes fees by phase: lower before kickoff, higher during volatile live moments, and cheaper again during settlement.',
    signal: '46 bps',
    metric: "63'",
  },
  {
    kicker: 'X Layer proof',
    title: 'Settle with receipts',
    body: 'Swaps, LP adds, hook updates, and claims become receipt-visible X Layer transactions for judges and users to verify.',
    signal: 'On-chain',
    metric: 'X Layer',
  },
]

function clampStep(index: number) {
  return Math.min(steps.length - 1, Math.max(0, index))
}

export function HowItWorksModal({ open, onClose }: HowItWorksModalProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const step = steps[stepIndex]
  const isLastStep = stepIndex === steps.length - 1

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStepIndex(0)
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null

  const closeModal = () => {
    setStepIndex(0)
    onClose()
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          closeModal()
        }
      }}
    >
      <section className="how-modal" role="dialog" aria-modal="true" aria-labelledby="how-modal-title">
        <button className="modal-close" type="button" onClick={closeModal} aria-label="Close how it works">
          X
        </button>

        <div className="how-visual" aria-hidden="true">
          <div className="how-side-card">
            <span>World Cup room</span>
          </div>
          <div className="how-market-card">
            <div className="how-card-topline">
              <span>{step.metric}</span>
              <strong>{step.signal}</strong>
            </div>
            <div className="how-card-brand">
              <KickoffMark />
              <span>Kickoff</span>
            </div>
            <h3>Argentina vs France live match market</h3>
            <div className="how-token-row">
              <span className="how-token">ARG</span>
              <span className="how-token">FRA</span>
              <span className="how-token">v4</span>
              <span className="how-token">OKB</span>
              <small>+38K tx</small>
            </div>
            <div className="how-card-metrics">
              <span>$842K LP</span>
              <span>46 bps</span>
              <span>X Layer</span>
            </div>
          </div>
          <div className="how-side-card">
            <span>Hook proof</span>
          </div>
        </div>

        <div className="how-body">
          <div className="how-progress">
            <span>{String(stepIndex + 1).padStart(2, '0')}</span>
            <div className="how-dots" aria-hidden="true">
              {steps.map((item) => (
                <i key={item.title} className={item.title === step.title ? 'is-active' : ''} />
              ))}
            </div>
          </div>

          <div className="how-copy">
            <span>{step.kicker}</span>
            <h2 id="how-modal-title">{step.title}</h2>
            <p>{step.body}</p>
          </div>

          <div className="how-actions">
            <button type="button" onClick={() => setStepIndex((current) => clampStep(current - 1))} disabled={stepIndex === 0}>
              Back
            </button>
            <button type="button" onClick={isLastStep ? closeModal : () => setStepIndex((current) => clampStep(current + 1))}>
              {isLastStep ? 'Start trading' : 'Next'}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
