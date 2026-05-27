type LoadingMarkProps = {
  label?: string
  size?: 'small' | 'regular'
}

export function LoadingMark({ label = 'Loading', size = 'regular' }: LoadingMarkProps) {
  return (
    <span className={`loading-mark loading-mark-${size}`} aria-label={label} role="status">
      <i />
      <i />
      <i />
      <i />
    </span>
  )
}
