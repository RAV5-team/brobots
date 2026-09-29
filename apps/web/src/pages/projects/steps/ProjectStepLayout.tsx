import { ArrowLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, generatePath } from 'react-router'
import { ROUTE_PATHS, projectStepPath } from '@/app/routePaths'
import { DemoBanner } from '@/components/shell/DemoBanner'
import { Chip } from '@/components/ui/Chip'
import { Stepper } from '@/components/ui/Stepper'
import { TextLink } from '@/components/ui/TextLink'
import { PROJECT_STEPS, isReadOnly, stepState, type Project, type ProjectStep } from '@/domain'
import { ru } from '@/shared/i18n/ru'

const t = ru.project

interface ProjectStepLayoutProps {
  readonly project: Project
  readonly locationName: string
  /** Открытый шаг — текущий в степпере. */
  readonly step: ProjectStep
  readonly isGuest: boolean
  /** Заголовок экрана шага: «Параметры проекта», «Подбор решения под процесс». */
  readonly title: string
  /** Надзаголовок капсом: «Итог оценки · РЦ Химки · перемещение паллет» (08). */
  readonly overline?: string
  readonly lead?: ReactNode
  /** Над заголовком: этапы симуляции (04–07). */
  readonly aboveTitle?: ReactNode
  /** Справа от заголовка: переключатель «Покупка · RaaS» (08). */
  readonly actions?: ReactNode
  /** Правая колонка 300: «Выбранный вариант», главное действие шага (02, 03). */
  readonly rail?: ReactNode
  /**
   * crumbs — каркас секции 15877:2 (крошки, степпер с номером перед подписью, rail рядом с заголовком, зазор 16);
   * board — каркас доски 16325 (16325:149): «← Проекты» и статус, короткий степпер «Параметры ✓ · … · Итог и экономика 4»,
   * заголовок во всю ширину, под ним две колонки с зазором 24 — основная (этапы `stages` и содержание) и rail.
   */
  readonly layout?: 'crumbs' | 'board'
  /** Только для board: статус справа от «← Проекты» — «Черновик сохранён · 15.09 14:32». У гостя и у сохранённой оценки его заменяют демо-плашка и «только просмотр». */
  readonly status?: ReactNode
  /** Только для board: навигация этапов симуляции (`Stepper variant="capsule"`) — над содержанием, вровень с верхом rail. */
  readonly stages?: ReactNode
  readonly children: ReactNode
}

/**
 * Каркас шага проекта (секция 15877:2, D-54): крошки и плашка режима, степпер 4 шагов, заголовок,
 * содержание и необязательная правая колонка. Меню — из shell по роли; в секции нарисовано гостевое.
 */
export function ProjectStepLayout(props: ProjectStepLayoutProps) {
  if (props.layout === 'board') return <BoardLayout {...props} />
  const { project, locationName, step, isGuest, title, overline, lead, aboveTitle, actions, rail, children } = props
  const steps = stepperSteps(project, step, ru.projectStepTitles)
  return (
    <>
      <div className="flex min-h-36 items-center justify-between gap-16">
        <Crumbs project={project} locationName={locationName} isGuest={isGuest} />
        {isGuest ? <DemoBanner /> : isReadOnly(project) && <Chip tone="ready" size="sm">{t.readOnly}</Chip>}
      </div>
      <Stepper label={t.stepsNav} steps={steps} />
      <div className="flex items-start gap-16">
        <div className="flex min-w-0 flex-1 flex-col gap-16">
          {aboveTitle}
          <StepHeader title={title} overline={overline} lead={lead} actions={actions} />
          {children}
        </div>
        {rail && <aside aria-label={title} className="flex w-(--rav-form-rail-width) shrink-0 flex-col gap-16">{rail}</aside>}
      </div>
    </>
  )
}

const stepperSteps = (project: Project, step: ProjectStep, labels: Readonly<Record<ProjectStep, string>>) =>
  PROJECT_STEPS.map((s) => ({
    key: s,
    label: labels[s],
    state: stepState(project, s, step),
    to: projectStepPath(project.id, s),
  }))

interface HeaderProps {
  readonly title: string
  readonly overline: string | undefined
  readonly lead: ReactNode
  readonly actions: ReactNode
}

function StepHeader({ title, overline, lead, actions }: HeaderProps) {
  return (
    <header className="flex items-end justify-between gap-16">
      <div className="flex min-w-0 flex-col gap-8">
        {overline && <p className="type-overline text-text-muted">{overline}</p>}
        <h1 className="type-display-lg text-text">{title}</h1>
        {lead && <p className="type-body text-text-secondary">{lead}</p>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  )
}

/** Каркас доски 16325: «← Проекты» и статус, короткий степпер, заголовок во всю ширину, колонки 1fr + 300 с зазором 24. */
function BoardLayout({ project, step, isGuest, title, overline, lead, actions, rail, status, stages, children }: ProjectStepLayoutProps) {
  const statusSlot = isGuest ? <DemoBanner /> : isReadOnly(project) ? <Chip tone="ready" size="sm">{t.readOnly}</Chip> : status
  return (
    <>
      <div className="flex min-h-36 items-center justify-between gap-16">
        {/* Гостю список проектов закрыт (D-82) — «← Проекты» текстом, как в крошках. */}
        {isGuest
          ? <span className="inline-flex items-center gap-4 type-label font-semibold text-text-secondary"><ArrowLeft aria-hidden size={16} />{ru.projects.title}</span>
          : <TextLink to={ROUTE_PATHS.projects} icon={ArrowLeft}>{ru.projects.title}</TextLink>}
        {statusSlot}
      </div>
      <Stepper label={t.stepsNav} steps={stepperSteps(project, step, ru.projectStepShortTitles)} marker="end" />
      <StepHeader title={title} overline={overline} lead={lead} actions={actions} />
      <div className="flex items-start gap-24">
        <div className="flex min-w-0 flex-1 flex-col gap-20">
          {stages}
          {children}
        </div>
        {rail && <aside aria-label={title} className="flex w-(--rav-form-rail-width) shrink-0 flex-col gap-16">{rail}</aside>}
      </div>
    </>
  )
}

/** Крошки: «Проекты › локация › проект». Гостю список проектов закрыт (D-82) — «Проекты» текстом. */
function Crumbs({ project, locationName, isGuest }: { readonly project: Project; readonly locationName: string; readonly isGuest: boolean }) {
  const separator = <ChevronRight aria-hidden size={12} className="shrink-0 text-text-muted" />
  const crumb = 'type-caption font-medium'
  const link = `${crumb} rounded-xs transition-colors hover:text-text`
  return (
    <nav aria-label={t.crumbsNav} className="min-w-0">
      <ol className="flex items-center gap-6 text-text-secondary">
        <li className="flex items-center gap-6">
          {isGuest
            ? <span className={crumb}>{ru.projects.title}</span>
            : <Link to={ROUTE_PATHS.projects} className={link}>{ru.projects.title}</Link>}
          {separator}
        </li>
        <li className="flex items-center gap-6">
          <Link to={generatePath(ROUTE_PATHS.location, { locationId: project.locationId })} className={link}>{locationName}</Link>
          {separator}
        </li>
        <li className="min-w-0">
          <span aria-current="page" className={`block truncate text-text ${crumb}`}>{project.name}</span>
        </li>
      </ol>
    </nav>
  )
}
