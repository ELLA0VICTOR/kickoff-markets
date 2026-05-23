import type { MatchMarket } from '../../data/markets'

type MatchPosterProps = {
  market: MatchMarket
  size?: 'card' | 'hero'
}

const palette = [
  ['#0f4c3a', '#f2c94c', '#1a1f2f'],
  ['#254f9a', '#f4f4f4', '#8f1d1d'],
  ['#7a1818', '#f1d37a', '#141414'],
  ['#133b5c', '#f8f8f8', '#195f4d'],
]

export function MatchPoster({ market, size = 'card' }: MatchPosterProps) {
  const index = Math.abs(market.id.split('').reduce((total, char) => total + char.charCodeAt(0), 0)) % palette.length
  const [home, middle, away] = palette[index]

  return (
    <svg
      className={size === 'hero' ? 'match-poster match-poster-hero' : 'match-poster'}
      viewBox="0 0 640 420"
      role="img"
      aria-label={`${market.sides[0].name} versus ${market.sides[1].name}`}
    >
      <rect width="640" height="420" fill="#080b10" />
      <rect x="24" y="24" width="592" height="372" fill="#0c1217" stroke="#1f2937" strokeWidth="2" />
      <path d="M24 24h296v372H24z" fill={home} opacity="0.88" />
      <path d="M320 24h296v372H320z" fill={away} opacity="0.88" />
      <rect x="290" y="24" width="60" height="372" fill={middle} opacity="0.92" />
      <circle cx="320" cy="210" r="68" fill="none" stroke="#d1d5db" strokeOpacity="0.35" strokeWidth="2" />
      <line x1="320" y1="24" x2="320" y2="396" stroke="#d1d5db" strokeOpacity="0.35" strokeWidth="2" />
      <rect x="24" y="122" width="94" height="176" fill="none" stroke="#d1d5db" strokeOpacity="0.28" strokeWidth="2" />
      <rect x="522" y="122" width="94" height="176" fill="none" stroke="#d1d5db" strokeOpacity="0.28" strokeWidth="2" />
      <text x="104" y="218" fill="#f3f4f6" fontFamily="ui-monospace, monospace" fontSize="64" fontWeight="800">
        {market.sides[0].code}
      </text>
      <text
        x="536"
        y="218"
        fill="#f3f4f6"
        fontFamily="ui-monospace, monospace"
        fontSize="64"
        fontWeight="800"
        textAnchor="end"
      >
        {market.sides[1].code}
      </text>
      <rect x="250" y="176" width="140" height="68" fill="#060a0f" stroke="#1f2937" strokeWidth="2" />
      <text
        x="320"
        y="221"
        fill="#8aebde"
        fontFamily="ui-monospace, monospace"
        fontSize="34"
        fontWeight="800"
        textAnchor="middle"
      >
        {market.score}
      </text>
      <rect x="252" y="48" width="136" height="34" fill="#060a0f" stroke="#047857" strokeWidth="2" />
      <text
        x="320"
        y="71"
        fill="#10b981"
        fontFamily="ui-monospace, monospace"
        fontSize="17"
        fontWeight="700"
        textAnchor="middle"
      >
        {market.minute}
      </text>
      <text x="44" y="366" fill="#e6a14b" fontFamily="ui-monospace, monospace" fontSize="18" fontWeight="700">
        {market.pool}
      </text>
    </svg>
  )
}
