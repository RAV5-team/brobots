import { ArrowRight } from 'lucide-react'
import { generatePath } from 'react-router'
import { ROUTE_PATHS } from '@/app/routePaths'
import { Card } from '@/components/ui/Card'
import { MergedButton } from '@/components/ui/MergedButton'
import { TextLink } from '@/components/ui/TextLink'
import type { LocationProcessId, ParamsReadiness, Project, ProjectParamsSnapshot } from '@/domain'
import { formatCount, formatDate } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import type { MissingItem } from './paramsModel'

const t = ru.project.params

interface ParamsRailProps {
  readonly project: Project
  readonly snapshot: ProjectParamsSnapshot
  readonly processId: LocationProcessId | null
  readonly readiness: ParamsReadiness | null
  readonly missing: readonly MissingItem[]
  /** Строка о сохранении: «Черновик сохранён · 10:42», демо-режим, только просмотр или ошибка. */
  readonly saveNote: { readonly text: string; readonly isError: boolean } | null
  readonly proceeding: boolean
  readonly proceedError: string | null
  readonly onProceed: () => void
}

/** Тексты плашки готовности по правилам PRD 11.2: блокировка — одна причина, иначе — все предупреждения. */
function readinessLines(readiness: ParamsReadiness, missing: readonly MissingItem[]): readonly string[] {
  const r = t.readiness
  if (!readiness.canMatch) {
    return [r.blocked(missing.filter((m) => m.impact === 'blocks').map((m) => m.label).join(', '))]
  }
  const site = readiness.siteChecks.length
  const siteCount = formatCount(site, ru.plural.parameters)
  const labor = readiness.laborSaving.map((m) => (m.code === 'salary' ? r.noSalary : r.noWorkers))
  const lines = [
    ...(site === 0 ? [] : [site === 1 ? r.siteCheck(siteCount) : r.siteChecks(siteCount)]),
    ...labor,
  ]
  return lines.length > 0 ? lines : [r.ready]
}

/** Где заполнить значение: параметры площадки — профиль локации, значения процесса — процесс на локации. */
function fillPath(project: Project, processId: LocationProcessId | null, item: MissingItem): string {
  if (item.scope === 'site' || processId === null) return `${generatePath(ROUTE_PATHS.locationParams, { locationId: project.locationId })}#${item.code}`
  return generatePath(ROUTE_PATHS.locationProcess, { locationId: project.locationId, locationProcessId: processId })
}

/** Правая колонка шага 1 (16197:636): «Подобрать решения», готовность к подбору, решение из каталога, версии данных. */
export function ParamsRail({
  project, snapshot, processId, readiness, missing, saveNote, proceeding, proceedError, onProceed,
}: ParamsRailProps) {
  const r = t.readiness
  const canMatch = readiness?.canMatch ?? false
  return (
    <>
      <MergedButton
        block
        label={r.match}
        icon={ArrowRight}
        disabled={!canMatch || proceeding}
        aria-describedby="params-readiness"
        onClick={onProceed}
      />
      {proceedError && <p role="alert" className="type-caption text-danger">{proceedError}</p>}
      <p className="type-caption text-text-secondary">
        {r.versions(formatDate(project.versions.snapshotAt), project.versions.catalog, project.versions.model)}
      </p>
      {readiness
        ? (
            <Card variant="sunken" padding={16} gap={8} as="section" aria-labelledby="params-readiness">
              <h2 id="params-readiness" className={readiness.canMatch ? 'type-body font-semibold text-text' : 'type-body font-semibold text-danger'}>
                {readiness.canMatch ? t.process.canMatch : t.process.blocked}
              </h2>
              <p className="type-caption text-text-secondary">
                {r.counters(formatCount(readiness.assumptionsCount, ru.plural.assumptions), readiness.missingCount)}
              </p>
              {readinessLines(readiness, missing).map((line) => <p key={line} className="type-caption text-text">{line}</p>)}
              {missing.length > 0 && (
                <div className="flex flex-col gap-4 pt-4">
                  <h3 className="type-overline font-medium text-text-muted">{r.whatToFill}</h3>
                  <ul className="flex flex-col gap-4">
                    {missing.map((item) => (
                      <li key={item.code}>
                        <TextLink to={fillPath(project, processId, item)}>{capitalize(item.label)}</TextLink>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )
        : <p id="params-readiness" className="type-caption text-text-secondary">{r.chooseProcess}</p>}
      {snapshot.pinnedSolution && (
        <Card variant="well" padding={16} gap={8} as="section" aria-labelledby="params-pinned">
          <p className="type-overline font-medium text-text-muted">{t.pinned.overline}</p>
          <h2 id="params-pinned" className="type-title-sm text-text">{snapshot.pinnedSolution.name}</h2>
          <p className="type-caption text-text-secondary">{t.pinned.lead}</p>
          <TextLink to={generatePath(ROUTE_PATHS.catalogItem, { itemId: snapshot.pinnedSolution.id })}>{t.pinned.open}</TextLink>
        </Card>
      )}
      {saveNote && (
        <p role={saveNote.isError ? 'alert' : 'status'} className={saveNote.isError ? 'type-caption text-danger' : 'type-caption text-text-secondary'}>
          {saveNote.text}
        </p>
      )}
    </>
  )
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
