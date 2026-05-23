export type HomeTab = 'All' | 'Live' | 'Upcoming' | 'Settling' | 'Portfolio'

type MarketTabsProps = {
  activeTab: HomeTab
  onTabChange: (tab: HomeTab) => void
}

const tabs: HomeTab[] = ['All', 'Live', 'Upcoming', 'Settling', 'Portfolio']

export function MarketTabs({ activeTab, onTabChange }: MarketTabsProps) {
  return (
    <nav className="market-tabs" aria-label="Market categories">
      {tabs.map((tab) => (
        <button
          className={activeTab === tab ? 'is-active' : ''}
          key={tab}
          type="button"
          onClick={() => onTabChange(tab)}
        >
          {tab}
        </button>
      ))}
    </nav>
  )
}
