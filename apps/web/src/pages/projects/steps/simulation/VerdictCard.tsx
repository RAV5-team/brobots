import { Card } from '@/components/ui/Card'
import type { SimulationRun } from '@/domain'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.simulation.verdict

/** Маркированный список пунктов прогона (16414:3514). */
function Points({ items, label }: { readonly items: readonly string[]; readonly label: string }) {
  return (
    <ul aria-label={label} className="flex flex-col gap-8">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-8 type-body text-text">
          <span aria-hidden className="mt-8 size-4 shrink-0 rounded-full bg-text-muted" />
          {item}
        </li>
      ))}
    </ul>
  )
}

/** Подраздел карточки: «Узкое место», «Что проверить на пилоте» (16414:3527). */
function Section({ id, title, lines }: { readonly id: string; readonly title: string; readonly lines: readonly string[] }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h3 id={id} className="type-title-sm text-text">{title}</h3>
      {lines.map((line) => <p key={line} className="type-body text-text">{line}</p>)}
    </section>
  )
}

/**
 * Карточка вердикта (3.4, 16414:3433; PRD 11.4): заголовок прогона, «оценка по худшему дню», пункты и «Узкое место».
 * Тексты — из прогона (simcore/verdict_text), числа — из его итогов (D-13). «Что проверить на пилоте» на доске убран —
 * пока показан подразделом ниже, ждёт решения 11 (D-104).
 */
export function VerdictCard({ run }: { readonly run: SimulationRun }) {
  const points = [...run.lines, ...run.justification]
  return (
    <Card as="section" padding={28} gap={20} aria-labelledby="verdict-title">
      <div className="flex flex-col gap-4">
        <h2 id="verdict-title" className="type-title-md text-text">{run.title}</h2>
        <p className="type-caption text-text-secondary">{t.worstDay}</p>
      </div>
      {points.length > 0 && <Points items={points} label={t.pointsLabel} />}
      {run.diagnosis.length > 0 && <Section id="verdict-bottleneck" title={t.bottleneck} lines={run.diagnosis} />}
      {run.risks.length > 0 && <Section id="verdict-pilot" title={t.pilot} lines={run.risks} />}
    </Card>
  )
}
