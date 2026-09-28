import { projectStepPath } from '@/app/routePaths'
import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import type { ProjectId, ProjectStep } from '@/domain'
import { ru } from '@/shared/i18n/ru'

const t = ru.project.economics.path

export interface PathStep {
  readonly step: Exclude<ProjectStep, 'economics'>
  readonly text: string
}

/**
 * «Как мы к этому пришли» (16197:2072): три пройденных шага строкой итога и ссылкой на шаг. Номер — плашка `Chip`,
 * ссылка — `ButtonLink` secondary sm (D-86). Шаги открываются и у сохранённой оценки — только для просмотра (D-17).
 */
export function PathCard({ projectId, steps }: { readonly projectId: ProjectId; readonly steps: readonly PathStep[] }) {
  return (
    <Card as="section" padding={24} gap={16} aria-labelledby="economics-path-title">
      <h2 id="economics-path-title" className="type-heading text-text">{t.title}</h2>
      <ol className="flex flex-col gap-14">
        {steps.map((item, index) => (
          <li key={item.step} className="flex items-start gap-14">
            <span aria-hidden className="shrink-0"><Chip size="sm" tone="neutral">{String(index + 1)}</Chip></span>
            <div className="flex min-w-0 flex-1 flex-col gap-4">
              <h3 className="type-body font-medium text-text">{t.steps[item.step]}</h3>
              <p className="type-body-sm text-text-secondary">{item.text}</p>
            </div>
            <ButtonLink size="sm" to={projectStepPath(projectId, item.step)}>{t.open[item.step]}</ButtonLink>
          </li>
        ))}
      </ol>
    </Card>
  )
}
