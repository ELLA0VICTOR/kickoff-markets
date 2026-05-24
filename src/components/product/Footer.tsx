import { KickoffMark } from './KickoffMark'

type FooterProps = {
  onCreateRoom: () => void
  onHowItWorks: () => void
}

export function Footer({ onCreateRoom, onHowItWorks }: FooterProps) {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <a className="brand" href="#" aria-label="Kickoff Markets home">
          <KickoffMark />
          <span>Kickoff</span>
        </a>
        <p>
          World Cup match markets on X Layer. Trade team outcomes, add liquidity, and verify Match Clock Hook
          receipts from kickoff to final whistle.
        </p>
      </div>

      <div className="footer-column">
        <h2>Markets</h2>
        <a href="#">All rooms</a>
        <a href="#live">Live</a>
        <a href="#upcoming">Upcoming</a>
        <button type="button" onClick={onCreateRoom}>
          Create room
        </button>
      </div>

      <div className="footer-column">
        <h2>Resources</h2>
        <a href="https://web3.okx.com/xlayer" target="_blank" rel="noreferrer">
          X Layer
        </a>
        <a href="https://web3.okx.com/xlayer/faucet" target="_blank" rel="noreferrer">
          Testnet faucet
        </a>
        <a href="https://web3.okx.com/onchainos" target="_blank" rel="noreferrer">
          Onchain OS
        </a>
        <button type="button" onClick={onHowItWorks}>
          How it works
        </button>
      </div>

      <div className="footer-column">
        <h2>Community</h2>
        <a href="https://x.com/XLayerOfficial" target="_blank" rel="noreferrer">
          X Layer
        </a>
        <a href="https://github.com/" target="_blank" rel="noreferrer">
          GitHub
        </a>
        <a href="https://t.me/" target="_blank" rel="noreferrer">
          Builder Hub
        </a>
      </div>
    </footer>
  )
}
