import type { FormEvent } from 'react'
import { useState } from 'react'
import type { MatchMarket } from '../../data/markets'

type CreateRoomModalProps = {
  open: boolean
  onClose: () => void
  onCreate: (market: MatchMarket) => void
}

function cleanCode(value: string) {
  return value.trim().slice(0, 3).toUpperCase() || 'TBD'
}

export function CreateRoomModal({ open, onClose, onCreate }: CreateRoomModalProps) {
  const [teamA, setTeamA] = useState('Nigeria')
  const [teamB, setTeamB] = useState('Portugal')
  const [kickoff, setKickoff] = useState('19:00 UTC')

  if (!open) return null

  function submitRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const sideA = teamA.trim() || 'Team A'
    const sideB = teamB.trim() || 'Team B'
    const codeA = cleanCode(sideA)
    const codeB = cleanCode(sideB)
    const createdAt = Date.now()

    onCreate({
      id: `${codeA.toLowerCase()}-${codeB.toLowerCase()}-${createdAt}`,
      stage: 'Custom room',
      kickoff: kickoff.trim() || 'TBD',
      phase: 'pre-match',
      minute: 'T-60m',
      score: '0 - 0',
      pool: `${codeA}/${codeB}-v4`,
      status: 'open',
      liquidity: 0,
      volume: 0,
      traders: 0,
      hookFeeBps: 18,
      baseFeeBps: 18,
      xLayerTx: 0,
      note: 'Room drafted locally. Deploying the pool will publish hook config and liquidity receipts on X Layer.',
      sides: [
        { code: codeA, name: sideA, price: 0.5, change: 0, liquidity: 0, conviction: 50 },
        { code: codeB, name: sideB, price: 0.5, change: 0, liquidity: 0, conviction: 50 },
      ],
      sparkline: [50, 50, 50, 50, 50, 50],
    })
    onClose()
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) {
          onClose()
        }
      }}
    >
      <section className="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-room-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close create room">
          X
        </button>
        <span>Create Room</span>
        <h2 id="create-room-title">Draft a match market</h2>
        <form onSubmit={submitRoom}>
          <label>
            <span>Side A</span>
            <input value={teamA} onChange={(event) => setTeamA(event.target.value)} />
          </label>
          <label>
            <span>Side B</span>
            <input value={teamB} onChange={(event) => setTeamB(event.target.value)} />
          </label>
          <label>
            <span>Kickoff</span>
            <input value={kickoff} onChange={(event) => setKickoff(event.target.value)} />
          </label>
          <button className="primary-action" type="submit">
            Create room
          </button>
        </form>
      </section>
    </div>
  )
}
