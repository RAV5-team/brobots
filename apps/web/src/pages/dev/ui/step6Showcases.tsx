import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { ButtonLink } from '@/components/ui/Button'
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

export function StatusBannerShowcase() {
  const c = ru.locations.created
  return (
    <ShowcaseSection title="StatusBanner">
      <StatusBanner
        title={c.title('РЦ Химки')}
        description={c.profile(['Склад', 'Москва', '20 000 м²', '180 сотрудников'], '78%')}
        action={<ButtonLink to="/locations">{c.open}</ButtonLink>}
      />
      <StatusBanner title={c.title('РЦ Химки')} />
    </ShowcaseSection>
  )
}

/** Состояние показывается на первой неактивной вкладке: капсула слишком широкая для колонок. */
const TAB_STATES = ['default', 'hover', 'active', 'focus'] as const

export function TabNavShowcase() {
  const l = ru.location
  const items = [
    { to: '/locations/LOC-01/params', label: l.tabs.params },
    { to: '/locations/LOC-01/processes', label: l.tabs.processes },
    { to: '/locations/LOC-01/documents', label: l.tabs.documents },
  ]
  return (
    <ShowcaseSection title="TabNav">
      <StateGrid
        states={['default']}
        rows={TAB_STATES.map((state) => ({
          label: ru.dev.states[state],
          render: () => <TabNav label={l.tabsLabel} items={items} activeTo="/locations/LOC-01/processes" data-demo-state={state} />,
        }))}
      />
    </ShowcaseSection>
  )
}
