import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { FormulaStats } from '@/components/ui/FormulaStats'
import { SectionNav } from '@/components/ui/SectionNav'
import { StatusBanner } from '@/components/ui/StatusBanner'
import { TabNav } from '@/components/ui/TabNav'
import { TextLink } from '@/components/ui/TextLink'
import { ru } from '@/shared/i18n/ru'
import { ShowcaseSection, StateGrid } from './StateGrid'

// Образцы — тексты экрана 09а: у примитивов нет своих подписей.
const p = ru.processNew
const NAV_ITEMS = (Object.keys(p.nav) as (keyof typeof p.nav)[]).map((id) => ({ id: `demo-${id}`, label: p.nav[id] }))

export function SectionNavShowcase() {
  const [active, setActive] = useState(NAV_ITEMS[0]?.id ?? '')
  return (
    <ShowcaseSection title="SectionNav">
      <SectionNav label={p.sectionNavLabel} items={NAV_ITEMS} activeId={active} onSelect={setActive} />
    </ShowcaseSection>
  )
}

export function FormulaStatsShowcase() {
  const s = p.volumeStats
  return (
    <ShowcaseSection title="FormulaStats">
      <FormulaStats
        label={s.label}
        stats={[
          { key: 'peak', label: s.peak, value: s.opsPerHour('136'), formula: s.peakFormula('2 000', '22', '1,5') },
          { key: 'toRobots', label: s.toRobots, value: s.tripsPerHour('130'), formula: s.toRobotsFormula('136', '0,95') },
          { key: 'average', label: s.average, value: s.opsPerHour('86'), formula: s.averageFormula('2 000', '0,95', '22') },
        ]}
      />
    </ShowcaseSection>
  )
}

export function TextLinkShowcase() {
  return (
    <ShowcaseSection title="TextLink">
      <TextLink to="/processes" icon={ArrowLeft}>{p.back}</TextLink>
    </ShowcaseSection>
  )
}

// Вкладки раздела «Администрирование» (А8, 15966:8024); ссылки ведут в разделы, активная — «Классы операций».
const ADMIN_TABS = (['catalog', 'norms', 'sources', 'operationClasses', 'journal'] as const).map((key) => ({
  key,
  label: ru.admin.tabs[key],
  to: `/dev/ui/tab-nav#${key}`,
}))

export function TabNavShowcase() {
  return (
    <ShowcaseSection title="TabNav">
      <StateGrid
        states={['default', 'hover', 'focus']}
        rows={[{ label: 'admin', render: (st) => <TabNav label={ru.admin.tabsLabel} items={ADMIN_TABS} activeKey="operationClasses" data-demo-state={st === 'default' ? undefined : st} /> }]}
      />
    </ShowcaseSection>
  )
}

export function StatusBannerShowcase() {
  const a = ru.adminCatalog.added
  return (
    <ShowcaseSection title="StatusBanner">
      <div className="flex w-[1000px] flex-col gap-16">
        <StatusBanner title={a.title} action={<Button variant="accent" className="h-40 px-20">{a.open}</Button>} />
        <StatusBanner title={a.title} />
      </div>
    </ShowcaseSection>
  )
}
