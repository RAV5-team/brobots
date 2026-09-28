import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Well } from '@/components/ui/Well'
import type { SimulationRun, SimulationVerdict } from '@/domain'
import { ru } from '@/shared/i18n/ru'
import { kpisLine } from './verdictModel'

const t = ru.project.simulation.verdict

/** Состав справляется — лаймовая плашка; проблема — светлая: лайм на экране — знак «всё в порядке». */
const PASSED: ReadonlySet<SimulationVerdict> = new Set(['confirmed', 'can_reduce'])

/** Список с лаймовыми точками (16197:1876). */
function Points({ items, label }: { readonly items: readonly string[]; readonly label: string }) {
  return (
    <ul aria-label={label} className="flex flex-col gap-8">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-10 type-body text-bg">
          <span aria-hidden className="mt-8 size-4 shrink-0 rounded-full bg-on-inverse" />
          {item}
        </li>
      ))}
    </ul>
  )
}

/**
 * «Карточка · вердикт» (16197:1870; PRD 11.4): плашка вердикта, итоги проверенного состава, заголовок и пункты прогона,
 * «Где тоньше всего» и «Что проверить на пилоте». Тексты — из прогона (simcore/verdict_text), числа — из его итогов.
 */
export function VerdictCard({ run }: { readonly run: SimulationRun }) {
  const name = run.label ? `${t.names[run.verdict]} · ${run.label}` : t.names[run.verdict]
  const points = [...run.lines, ...run.justification]
  return (
    <Card as="section" variant="inverse" padding={24} gap={16} aria-labelledby="verdict-title">
      <div className="flex flex-wrap items-center gap-10">
        <Chip tone={PASSED.has(run.verdict) ? 'ready' : 'neutral'}>{name}</Chip>
        <p className="type-caption text-text-disabled">{kpisLine(run.before)}</p>
        <p className="ml-auto type-caption text-text-disabled">{t.runLabel(run.id)}</p>
      </div>
      <h2 id="verdict-title" className="type-display-md text-bg">{run.title}</h2>
      {points.length > 0 && <Points items={points} label={t.pointsLabel} />}
      {run.diagnosis.length > 0 && (
        <Well title={t.thinnest}>
          {run.diagnosis.map((line) => <p key={line} className="type-body-sm text-bg">{line}</p>)}
        </Well>
      )}
      {run.risks.length > 0 && (
        <Well title={t.pilot}>
          <ul className="flex flex-col gap-4">
            {run.risks.map((line) => <li key={line} className="type-body-sm text-bg">{line}</li>)}
          </ul>
        </Well>
      )}
    </Card>
  )
}
