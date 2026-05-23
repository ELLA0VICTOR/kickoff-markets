import type { ReactNode } from 'react'

type SectionHeaderProps = {
  number: string
  title: string
  action?: ReactNode
}

export function SectionHeader({ number, title, action }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[var(--label)]">{number}</span>
        <span className="truncate">{title}</span>
      </div>
      {action ? <div className="ml-auto shrink-0">{action}</div> : null}
    </div>
  )
}
