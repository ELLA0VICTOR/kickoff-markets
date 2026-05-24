import type { FormEvent } from 'react'
import { useState } from 'react'
import type { RoomDraft } from '../../data/markets'

type CreateRoomModalProps = {
  open: boolean
  onClose: () => void
  onCreate: (draft: RoomDraft) => Promise<void> | void
}

export function CreateRoomModal({ open, onClose, onCreate }: CreateRoomModalProps) {
  const [teamA, setTeamA] = useState('Nigeria')
  const [teamB, setTeamB] = useState('Portugal')
  const [kickoff, setKickoff] = useState('19:00 UTC')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  if (!open) return null

  async function submitRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(undefined)

    try {
      await onCreate({
        teamA: teamA.trim() || 'Team A',
        teamB: teamB.trim() || 'Team B',
        kickoff: kickoff.trim() || 'TBD',
      })
      onClose()
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Room creation failed.')
    } finally {
      setPending(false)
    }
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
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-action" type="submit" disabled={pending}>
            {pending ? 'Creating' : 'Create room'}
          </button>
        </form>
      </section>
    </div>
  )
}
