import { ArrowLeft } from 'lucide-react'
import { useLocation } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { CompareTable, type CompareGroup } from '@/components/ui/CompareTable'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { TextLink } from '@/components/ui/TextLink'
import { COMPARE_LIMIT } from '@/domain'
import { useCompare } from '@/shared/compare/useCompare'
import { ru } from '@/shared/i18n/ru'
import { entryName, entryRef, type CatalogEntry } from '../catalogModel'
import { CompareColumnHead } from './CompareColumnHead'
import { buildCompareGroups, resolveEntries, type CompareModelGroup, type CompareValue } from './compareModel'
import { backToCatalogPath } from './comparePaths'
import { useCompareData, type CompareData } from './useCompareData'

const t = ru.catalog.comparePage

function ValueContent({ value }: { readonly value: CompareValue }) {
  if (value.kind !== 'chips') return value.text
  return (
    <span className="flex flex-wrap gap-6">
      {value.items.map((item) => <Chip key={item} tone={value.tone === 'unconfirmed' ? 'unconfirmed' : 'neutral'}>{item}</Chip>)}
    </span>
  )
}

const toneOf = (value: CompareValue) => {
  if (value.kind === 'fit') return value.status
  if (value.kind === 'chips') return value.tone === 'panel' ? 'panel' : 'default'
  return value.tone
}

const toTableGroups = (groups: readonly CompareModelGroup[], entries: readonly CatalogEntry[]): readonly CompareGroup[] =>
  groups.map((group) => ({
    key: group.key,
    title: group.title,
    rows: group.rows.map((row) => ({
      key: row.key,
      label: row.label,
      cells: row.values.map((value, i) => ({
        key: entries[i] ? entryRef(entries[i]).id : String(i),
        tone: toneOf(value),
        content: <ValueContent value={value} />,
      })),
    })),
  }))

function CompareContent({ data }: { readonly data: CompareData }) {
  const { entries: selected, toggle } = useCompare()
  const entries = resolveEntries(selected, data.robots, data.launchItems)

  if (entries.length === 0) return <EmptyState size="lg" title={t.empty.title} description={t.empty.description} />

  const groups = buildCompareGroups(entries, { ...data, items: data.launchItems })
  return (
    <Card padding={20} gap={0}>
      <CompareTable
        caption={t.caption}
        columns={entries.map((entry) => ({
          key: entryRef(entry).id,
          label: entryName(entry),
          header: <CompareColumnHead entry={entry} onRemove={() => { toggle(entryRef(entry)) }} />,
        }))}
        groups={toTableGroups(groups, entries)}
      />
    </Card>
  )
}

/** Экран К-3 «Каталог · сравнение» (PRD 7.6; 16642:2489). До 4 позиций из общего набора (D-58, D-69); гостю — без сохранения. */
export function ComparePage() {
  const routeState: unknown = useLocation().state
  const { state, retry } = useCompareData()
  const { entries: selected, clear, error } = useCompare()

  return (
    <>
      <TextLink to={backToCatalogPath(routeState)} icon={ArrowLeft} className="self-start">{t.back}</TextLink>
      <header className="flex items-end justify-between gap-16">
        <div className="flex flex-col gap-4">
          <h1 className="type-display-lg text-text">{t.title}</h1>
          <p className="type-body text-text-secondary">
            <span className="font-medium text-text">{t.selected(selected.length, COMPARE_LIMIT)}</span>
            {t.greyHint}
          </p>
        </div>
        <Button onClick={clear} disabled={selected.length === 0}>{t.clear}</Button>
      </header>
      {error && <p role="alert" className="type-body-sm text-danger">{error}</p>}

      {state.status === 'loading' && <Skeleton className="h-(--rav-empty-panel-min-height)" />}
      {state.status === 'error' && <ErrorState title={ru.catalog.error.title} message={ru.catalog.error.message} onRetry={retry} />}
      {state.status === 'ready' && <CompareContent data={state} />}
    </>
  )
}
