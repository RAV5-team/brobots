import { ChevronDown, ChevronUp } from 'lucide-react'
import { Fragment, useState } from 'react'
import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Disclosure } from '@/components/ui/Disclosure'
import { IconButton } from '@/components/ui/IconButton'
import { RadioTable, type RadioTableRow } from '@/components/ui/RadioTable'
import type { LocationProcessId, ParamsProcessEntry, ProjectParamsSnapshot } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { LoadEstimate } from './LoadEstimate'
import { ParamRows } from './ParamRows'
import { groupCaption, type MissingItem, type ParamsView, type RowGroup } from './paramsModel'
import { StatusChip } from './StatusChip'
import { processGroupKey, type GroupReveal } from './useGroupReveal'
import { WorkersTable } from './WorkersTable'

const t = ru.project.params

interface ProcessBlockProps {
  readonly view: ParamsView
  readonly snapshot: ProjectParamsSnapshot
  readonly onSelect: (id: LocationProcessId) => void
  readonly readOnly: boolean
  readonly groups: GroupReveal
  readonly onReveal: (item: MissingItem) => void
  /** «Всё раскрыто» (16992:10): группы раскрывает `groups`, здесь — разбор нагрузки. */
  readonly expanded?: boolean
}

interface GroupsProps {
  readonly entry: ParamsProcessEntry
  readonly view: ParamsView
  readonly snapshot: ProjectParamsSnapshot
  readonly groups: GroupReveal
  readonly expanded: boolean
}

function GroupBody({ group, entry, view, snapshot, expanded }: { readonly group: RowGroup } & Omit<GroupsProps, 'groups'>) {
  const title = t.groupTitles[group.key] ?? group.title
  if (group.key === 'workers') return <WorkersTable entry={entry} snapshot={snapshot} assumptions={view.assumptions} />
  if (group.key !== 'load') return <ParamRows label={title} rows={group.rows} />
  // Нагрузка в пик — не строка, а отдельный расчёт с разбором (16992:398).
  const rows = group.rows.filter((r) => r.key !== 'peakLoad')
  return (
    <>
      <ParamRows label={title} rows={rows} />
      <LoadEstimate entry={entry} assumptions={view.assumptions} rows={rows} defaultOpen={expanded} />
    </>
  )
}

/** Подложка выбранного процесса (16969:65): группы А–Г свёрнуты, внизу — «Все параметры процесса» и профиль процесса. */
/** Группа «Маршрут» у процесса без маршрута (упаковка, 17009:1010): вместо строк — пояснение. */
const NO_ROUTE_KEY = processGroupKey('route')

function ProcessGroups({ entry, view, snapshot, groups, expanded }: GroupsProps) {
  const keys = [...view.groups.map((g) => processGroupKey(g.key)), ...(view.routeApplies ? [] : [NO_ROUTE_KEY])]
  const allOpen = keys.every((key) => groups.isOpen(key))
  const profile = generatePath(ROUTE_PATHS.locationProcess, { locationId: snapshot.location.id, locationProcessId: entry.locationProcess.id })
  return (
    <Card variant="sunken" padding={16} gap={16} as="div" className="px-20">
      <div className="flex flex-col">
        {view.groups.map((group) => {
          const key = processGroupKey(group.key)
          const rows = group.key === 'load' ? group.rows.filter((r) => r.key !== 'peakLoad') : group.rows
          return (
            <Fragment key={group.key}>
              {/* Порядок групп как на доске: «Маршрут» перед «Исполнителями» и у процесса без маршрута. */}
              {group.key === 'workers' && !view.routeApplies && (
                <Disclosure
                  variant="group"
                  title={t.groupTitles.route}
                  caption={t.routeNotApplied.caption}
                  open={groups.isOpen(NO_ROUTE_KEY)}
                  onOpenChange={(open) => { groups.setOpen(NO_ROUTE_KEY, open) }}
                >
                  <p className="py-8 type-body text-text-secondary">{t.routeNotApplied.text}</p>
                </Disclosure>
              )}
              <Disclosure
                variant="group"
                title={t.groupTitles[group.key] ?? group.title}
                caption={groupCaption(rows)}
                open={groups.isOpen(key)}
                onOpenChange={(open) => { groups.setOpen(key, open) }}
                className="last:border-b-0"
              >
                <GroupBody group={group} entry={entry} view={view} snapshot={snapshot} expanded={expanded} />
              </Disclosure>
            </Fragment>
          )
        })}
      </div>
      <div className="flex justify-end gap-12">
        {/* Дополнительных параметров процесса в данных нет (ждёт D-91): кнопка раскрывает все группы. */}
        <Button onClick={() => { groups.setMany(keys, !allOpen) }}>{allOpen ? t.process.collapseParams : t.process.allParams}</Button>
        <ButtonLink to={profile}>{t.process.editProcess}</ButtonLink>
      </div>
    </Card>
  )
}

/** Блок 1 «Выбор процесса» (16969:35): процессы локации таблицей-радиогруппой, у выбранного — группы значений. */
export function ProcessBlock({ view, snapshot, onSelect, readOnly, groups, onReveal, expanded = false }: ProcessBlockProps) {
  const [collapsed, setCollapsed] = useState(false)
  const selectedId = view.selected?.locationProcess.id ?? null
  const select = (id: LocationProcessId) => {
    setCollapsed(false)
    onSelect(id)
  }

  const rows: readonly RadioTableRow<LocationProcessId>[] = view.cards.map((card) => {
    const selected = card.id === selectedId
    const open = selected && !collapsed
    return {
      value: card.id,
      label: card.name,
      cells: [
        <span key="name" className="flex flex-col gap-2">
          <span className="type-body font-semibold text-text">{card.name}</span>
          <span className="type-caption text-text-secondary">{card.operationClass} · {card.workers}</span>
        </span>,
        <span key="volume" className="flex flex-col items-end gap-2 whitespace-nowrap">
          <span>{card.volumeValue}</span>
          <span className="type-caption font-normal text-text-secondary">{card.volumeUnit}</span>
        </span>,
      ],
      trailing: (
        <span className="flex flex-1 items-center justify-between gap-8">
          <StatusChip processId={card.id} processName={card.name} locationId={snapshot.location.id} missing={card.missing} selected={selected} onReveal={onReveal} />
          <IconButton
            variant="ghost"
            size={36}
            icon={open ? ChevronUp : ChevronDown}
            label={open ? t.process.collapse(card.name) : t.process.expand(card.name)}
            aria-expanded={open}
            // Только просмотр (D-17): шеврон невыбранной строки выбирал бы процесс — его нет.
            disabled={readOnly && !selected}
            onClick={() => { if (selected) setCollapsed(open); else select(card.id) }}
          />
        </span>
      ),
      expanded: open,
      ...(selected && view.selected ? { detail: <ProcessGroups entry={view.selected} view={view} snapshot={snapshot} groups={groups} expanded={expanded} /> } : {}),
    }
  })

  return (
    <Card aria-labelledby="params-process-title" padding={28} gap={20}>
      <header className="flex flex-col gap-4">
        <h2 id="params-process-title" className="type-heading text-text">{t.process.title}</h2>
        <p className="type-caption text-text-secondary">{t.process.hint}</p>
      </header>
      <RadioTable
        label={t.process.choice}
        columns={[
          { key: 'process', label: t.process.columns.process },
          { key: 'volume', label: t.process.columns.volume, widthClass: 'w-(--rav-params-source-width)' },
        ]}
        trailingColumn={{ key: 'data', label: t.process.columns.data, widthClass: 'w-(--rav-params-label-width)' }}
        rows={rows}
        value={selectedId}
        onChange={select}
        readOnly={readOnly}
      />
    </Card>
  )
}
