import { ButtonLink } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { ru } from '@/shared/i18n/ru'
import { catalogHref } from './processDetailModel'

const t = ru.processCard.rail

interface ProcessDetailRailProps {
  readonly classCode: string
  readonly classLabel: string
}

/** Правая колонка: ключ подбора, переход в каталог и «Как это работает» (PRD 9.3; 15935:1559). */
export function ProcessDetailRail({ classCode, classLabel }: ProcessDetailRailProps) {
  return (
    <aside className="flex w-(--rav-form-rail-width) shrink-0 flex-col gap-16 self-start">
      <Card elevation="md" aria-labelledby="class-key-title">
        <div className="flex flex-col items-start gap-6">
          <h2 id="class-key-title" className="type-overline text-text-muted">{t.classTitle}</h2>
          <Chip size="md">{classLabel}</Chip>
          <p className="type-caption text-text-secondary">{t.classNote}</p>
        </div>
        <ButtonLink to={catalogHref(classCode)} size="sm" className="self-start">{t.openCatalog}</ButtonLink>
      </Card>
      <section aria-labelledby="how-title" className="surface-inverse flex flex-col gap-8 rounded-xl bg-inverse p-20 drop-shadow-popover">
        <h2 id="how-title" className="type-heading text-bg">{t.howTitle}</h2>
        <p className="type-body text-text-disabled">{t.howText}</p>
      </section>
    </aside>
  )
}
