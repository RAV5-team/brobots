import { ArrowLeft, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router'
import { ROUTE_PATHS, projectStepPath } from '@/app/routePaths'
import { Button, ButtonLink } from '@/components/ui/Button'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { StatusBanner } from '@/components/ui/StatusBanner'
import { TextLink } from '@/components/ui/TextLink'
import { useRole } from '@/shared/auth/useRole'
import { formatDate } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { reportContext, type ReportContext } from './reportModel'
import { AppendixSection } from './sections/AppendixSection'
import { AssumptionsSection } from './sections/AssumptionsSection'
import { CashFlowSection } from './sections/CashFlowSection'
import { ConfigSection } from './sections/ConfigSection'
import { EconomicsSection } from './sections/EconomicsSection'
import { InputsSection } from './sections/InputsSection'
import { SensitivitySection } from './sections/SensitivitySection'
import { SimulationSection } from './sections/SimulationSection'
import { SummarySection } from './sections/SummarySection'
import { SupplySection } from './sections/SupplySection'
import { TaskSection } from './sections/TaskSection'
import { VariantsSection } from './sections/VariantsSection'
import { useReport } from './useReport'

const t = ru.report

/** Строка для `content` в CSS: кавычки и обратная косая экранируются. */
const cssString = (text: string): string => `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

/**
 * Поля печатной страницы (D-107): слева — «RAV5 · Предварительная оценка · {проект}», справа — «стр. N из M».
 * Текст — из словаря, поэтому правило собирается здесь; оформление полей — в `print.css`.
 */
function PageMargins({ left }: { readonly left: string }) {
  const css = `@page { @bottom-left { content: ${cssString(left)}; } @bottom-right { content: ${cssString(t.page.before)} counter(page) ${cssString(t.page.between)} counter(pages); } }`
  return <style>{css}</style>
}

const today = (): string => formatDate(new Date().toISOString().slice(0, 10))

function Toolbar({ ctx }: { readonly ctx: ReportContext }) {
  const b = t.toolbar
  const hint = { saved: b.saved(ctx.calcDate), draft: b.draft, guest: b.guest }[ctx.mode]
  return (
    <nav aria-label={b.label} className="flex w-(--rav-report-width) items-center gap-16 print:hidden">
      <TextLink to={projectStepPath(ctx.project.id, 'economics')} icon={ArrowLeft}>{b.back}</TextLink>
      <p className="flex-1 type-body-sm text-text-secondary">{hint}</p>
      <Button variant="primary" onClick={() => { window.print() }}>
        <Printer aria-hidden size={16} />
        {b.print}
      </Button>
    </nav>
  )
}

/** Шапка (16197:2319–2324): бренд и строка отчёта, заголовок, объект и версии (PRD 11.6). */
function ReportHeader({ ctx }: { readonly ctx: ReportContext }) {
  const { project } = ctx
  return (
    <header className="flex flex-col gap-28">
      <p className="flex items-center gap-16">
        <span className="type-title-md text-text">{t.brand}</span>
        <span className="type-body-sm text-text-muted">{[t.kind, t.calculated(ctx.calcDate), t.generated(today())].join(' · ')}</span>
      </p>
      <h1 className="type-display-lg text-text">{t.title}</h1>
      <p className="type-body-sm text-text-secondary">
        {t.meta(ctx.location.name, ctx.facts?.name ?? '—', ctx.calcDate, project.versions.model, project.versions.catalog)}
      </p>
    </header>
  )
}

function Sheet({ children }: { readonly children: ReactNode }) {
  return (
    <article className="print-exact flex w-(--rav-report-width) flex-col gap-40 rounded-2xl bg-bg p-(--rav-report-pad) shadow-raised-lg print:w-auto print:rounded-none print:bg-transparent print:p-0 print:shadow-none">
      {children}
    </article>
  )
}

function Report({ ctx }: { readonly ctx: ReportContext }) {
  return (
    <>
      <title>{t.documentTitle(ctx.project.name)}</title>
      <PageMargins left={[t.brand, t.kind, ctx.project.name].join(' · ')} />
      <Toolbar ctx={ctx} />
      <Sheet>
        <ReportHeader ctx={ctx} />
        <StatusBanner variant="danger" title={ru.project.economics.footer.disclaimer} />
        <SummarySection ctx={ctx} />
        <TaskSection ctx={ctx} />
        <InputsSection ctx={ctx} />
        <VariantsSection ctx={ctx} />
        <ConfigSection ctx={ctx} />
        <SupplySection ctx={ctx} />
        <EconomicsSection ctx={ctx} />
        <CashFlowSection ctx={ctx} />
        <SimulationSection ctx={ctx} />
        <SensitivitySection ctx={ctx} />
        <AssumptionsSection ctx={ctx} />
        <AppendixSection ctx={ctx} />
      </Sheet>
    </>
  )
}

/**
 * Отчёт PDF `/projects/:projectId/report` (экран 09, 16197:2318; PRD 11.6; D-15, D-107): печатный шаблон вне каркаса
 * кабинета — лист 1240 на экране, A4 в печати, каждый из 12 разделов с новой страницы. Числа — функциями итога 08.
 */
export function ReportPage() {
  const { projectId = '' } = useParams()
  const role = useRole()
  const { load, retry } = useReport(projectId)
  const ctx = load.status === 'ready' ? reportContext(load.data, role === 'guest') : null

  const body = (() => {
    if (load.status === 'redirect') return <Navigate to={load.to} replace />
    if (load.status === 'loading') return <div aria-busy="true" className="w-(--rav-report-width)"><Skeleton className="h-(--rav-location-card-height)" /></div>
    if (load.status === 'notFound') {
      return <EmptyState size="lg" title={t.notFound.title} description={t.notFound.description} action={<ButtonLink to={ROUTE_PATHS.projects}>{t.notFound.back}</ButtonLink>} />
    }
    if (load.status === 'noSelection') {
      return (
        <EmptyState
          size="lg"
          title={t.noSelection.title}
          description={t.noSelection.description}
          action={<ButtonLink to={projectStepPath(load.project.id, 'matching')}>{t.noSelection.action}</ButtonLink>}
        />
      )
    }
    if (load.status === 'error' || !ctx) return <ErrorState title={t.loadError.title} message={t.loadError.message} onRetry={retry} />
    return <Report ctx={ctx} />
  })()

  return (
    <main className="flex min-h-screen flex-col items-center gap-16 bg-surface-sunken px-24 py-32 print:block print:min-h-0 print:bg-transparent print:p-0">
      {body}
    </main>
  )
}
