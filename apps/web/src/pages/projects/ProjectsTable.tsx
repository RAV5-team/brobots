import { ArrowRight } from 'lucide-react'
import { useNavigate } from 'react-router'
import { projectOpenPath } from '@/app/routePaths'
import { Chip } from '@/components/ui/Chip'
import { IconButtonLink } from '@/components/ui/IconButton'
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui/Table'
import type { Project } from '@/domain'
import { formatRubTenthFixed, formatYears } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'
import { stageLabel, type ProjectRow } from './projectsModel'

const t = ru.projects
// Один знак во всей колонке: «84,0 млн ₽» рядом с «6,1 млн ₽» (PRD 11.1, макет A1).
const money = formatRubTenthFixed

function StatusCell({ project }: { readonly project: Project }) {
  if (project.status === 'saved') return <Chip tone="ready">{t.status.saved}</Chip>
  return (
    <div className="flex flex-col items-start gap-4">
      <Chip>{t.status.draft}</Chip>
      {/* Подписи на макете нет, она из PRD 11.1 (D-83). */}
      <span className="type-caption whitespace-nowrap text-text-muted">{t.stoppedAt(stageLabel(project.step))}</span>
    </div>
  )
}

/** CAPEX · OPEX / год · окупаемость — из снимка сохранённой оценки; у черновика прочерк (D-81). */
function resultCells(project: Project): readonly [string, string, string] {
  if (project.status === 'draft') return [t.noValue, t.noValue, t.noValue]
  const { capexRub, opexRubPerYear, paybackYears } = project.result
  return [money(capexRub), money(opexRubPerYear), formatYears(paybackYears, { fixed: true })]
}

function ProjectTableRow({ project, locationName }: ProjectRow) {
  const navigate = useNavigate()
  const to = projectOpenPath(project)
  const [capex, opex, payback] = resultCells(project)
  return (
    <TableRow onClick={() => { void navigate(to) }}>
      <TableCell className="font-semibold">{project.name}</TableCell>
      <TableCell className="font-medium">{locationName}</TableCell>
      <TableCell><StatusCell project={project} /></TableCell>
      <TableCell align="end" className="font-medium">{capex}</TableCell>
      <TableCell align="end" className="font-medium">{opex}</TableCell>
      <TableCell align="end" className="font-medium">{payback}</TableCell>
      <TableCell>
        <IconButtonLink icon={ArrowRight} size={36} label={t.open(project.name)} to={to} />
      </TableCell>
    </TableRow>
  )
}

/** Таблица списка проектов (A1, 16362:8225): колонки по макету, ширины — токены `--rav-projects-*`. */
export function ProjectsTable({ rows }: { readonly rows: readonly ProjectRow[] }) {
  const c = t.columns
  return (
    <Table caption={t.tableCaption} density="roomy" layout="fixed">
      <TableHead>
        <tr>
          <TableHeaderCell>{c.name}</TableHeaderCell>
          <TableHeaderCell className="w-(--rav-projects-location-width)">{c.location}</TableHeaderCell>
          <TableHeaderCell className="w-(--rav-projects-status-width)">{c.status}</TableHeaderCell>
          <TableHeaderCell align="end" className="w-(--rav-projects-money-width)">{c.capex}</TableHeaderCell>
          <TableHeaderCell align="end" className="w-(--rav-projects-money-width)">{c.opex}</TableHeaderCell>
          <TableHeaderCell align="end" className="w-(--rav-projects-payback-width)">{c.payback}</TableHeaderCell>
          <TableHeaderCell className="w-(--rav-projects-action-width)"><span className="sr-only">{c.action}</span></TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        {rows.map((row) => <ProjectTableRow key={row.project.id} {...row} />)}
      </TableBody>
    </Table>
  )
}
