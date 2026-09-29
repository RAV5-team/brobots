import { ArrowDown, ArrowRight } from 'lucide-react'
import { generatePath, useNavigate } from 'react-router'
import { ROUTE_PATHS, projectStepPath } from '@/app/routePaths'
import { Card } from '@/components/ui/Card'
import { MergedButton } from '@/components/ui/MergedButton'
import { TextLink } from '@/components/ui/TextLink'
import type { ParamsReadiness, Project, ProjectParamsSnapshot } from '@/domain'
import { formatCount } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { ASSUMPTIONS_ANCHOR, type MissingItem } from './paramsModel'

const t = ru.project.params

interface ParamsRailProps {
  readonly project: Project
  readonly snapshot: ProjectParamsSnapshot
  readonly readiness: ParamsReadiness | null
  readonly missing: readonly MissingItem[]
  /** «Нет данных ↓»: раскрыть группу первого незаполненного значения и перейти к нему. */
  readonly onRevealMissing: (item: MissingItem) => void
}

/** Вывод и правило под счётчиками (PRD 11.2): блокировка — одна причина, иначе — проверки площадки и экономия труда. */
function readinessText(readiness: ParamsReadiness, missing: readonly MissingItem[]): { readonly title: string; readonly lines: readonly string[] } {
  const r = t.readiness
  if (!readiness.canMatch) {
    return { title: r.blockedTitle(missing.filter((m) => m.impact === 'blocks').map((m) => m.label).join(', ')), lines: [r.blocked] }
  }
  const site = readiness.siteChecks.length
  const siteCount = formatCount(site, ru.plural.parameters)
  const labor = readiness.laborSaving.map((m) => (m.code === 'salary' ? r.noSalary : r.noWorkers))
  if (site > 0) return { title: site === 1 ? r.siteCheck(siteCount) : r.siteChecks(siteCount), lines: [r.checkRule, ...labor] }
  return { title: r.ready, lines: labor }
}

interface CounterProps {
  readonly label: string
  readonly count: number
  readonly href?: string
  readonly onClick?: () => void
}

/** Строка-счётчик: «Допущения 3 ↓» — число совпадает с таблицей (правило cap 1.1), «—», если 0. */
function Counter({ label, count, href, onClick }: CounterProps) {
  const value = <span className="inline-flex items-center gap-4 type-body font-semibold text-text">{count}<ArrowDown aria-hidden size={14} /></span>
  return (
    <div className="flex items-center gap-8 py-8">
      <dt className="flex-1 type-body text-text-secondary">{label}</dt>
      <dd>
        {count === 0 && <span className="type-body font-semibold text-text-muted">—</span>}
        {count > 0 && href && <a href={href} aria-label={t.readiness.goTo(label, count)} className="rounded-xs">{value}</a>}
        {count > 0 && onClick && <button type="button" aria-label={t.readiness.goTo(label, count)} className="rounded-xs" onClick={onClick}>{value}</button>}
      </dd>
    </div>
  )
}

/** Правая колонка шага 1 (16975:2): «Готовность к подбору» над «Подобрать решения», решение из каталога. */
export function ParamsRail({ project, snapshot, readiness, missing, onRevealMissing }: ParamsRailProps) {
  const navigate = useNavigate()
  const r = t.readiness
  const canMatch = readiness?.canMatch ?? false
  const text = readiness ? readinessText(readiness, missing) : null
  const first = missing[0]
  return (
    <>
      {readiness && text
        ? (
            <Card as="section" gap={12} aria-labelledby="params-readiness">
              <p className="type-overline font-medium text-text-muted">{r.overline}</p>
              <h2 id="params-readiness" className="type-heading text-text">{text.title}</h2>
              <dl className="flex flex-col">
                <Counter label={r.assumptions} count={readiness.assumptionsCount - readiness.normsCount} href={`#${ASSUMPTIONS_ANCHOR}`} />
                <Counter label={r.norms} count={readiness.normsCount} href={`#${ASSUMPTIONS_ANCHOR}`} />
                <Counter label={r.missing} count={readiness.missingCount} {...(first ? { onClick: () => { onRevealMissing(first) } } : {})} />
              </dl>
              {/* Правило и последствия — одним абзацем, как на доске (17009:1840). */}
              {text.lines.length > 0 && <p className="type-caption text-text-secondary">{text.lines.join('. ')}</p>}
            </Card>
          )
        : <p id="params-readiness" className="type-caption text-text-secondary">{r.chooseProcess}</p>}
      <MergedButton
        block
        label={r.match}
        icon={ArrowRight}
        disabled={!canMatch}
        aria-describedby="params-readiness"
        onClick={() => { void navigate(projectStepPath(project.id, 'matching')) }}
      />
      {/* На доске карточки нет; у PJ-DEMO закреплённого решения нет — оставлена до решения по D-57. */}
      {snapshot.pinnedSolution && (
        <Card variant="well" padding={16} gap={8} as="section" aria-labelledby="params-pinned">
          <p className="type-overline font-medium text-text-muted">{t.pinned.overline}</p>
          <h2 id="params-pinned" className="type-title-sm text-text">{snapshot.pinnedSolution.name}</h2>
          <p className="type-caption text-text-secondary">{t.pinned.lead}</p>
          <TextLink to={generatePath(ROUTE_PATHS.catalogItem, { itemId: snapshot.pinnedSolution.id })}>{t.pinned.open}</TextLink>
        </Card>
      )}
    </>
  )
}
