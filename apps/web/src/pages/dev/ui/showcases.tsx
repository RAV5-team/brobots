import type { ComponentType } from 'react'
import { ShellShowcase } from './ShellShowcase'
import { ButtonShowcase, FieldShowcase, InputShowcase, SearchShowcase } from './step1Showcases'
import { CheckboxShowcase, RadioShowcase, SegmentedShowcase, SelectShowcase } from './step2Showcases'
import { BadgeShowcase, ChipShowcase, ToggleShowcase } from './step3Showcases'
import { CardShowcase, ProgressShowcase, SectionHeaderShowcase, TableShowcase } from './step4Showcases'
import { DropzoneShowcase, ModalShowcase, StatesShowcase } from './step5Showcases'
import { FormulaStatsShowcase, SectionNavShowcase, TextLinkShowcase } from './step6Showcases'

export interface Showcase {
  readonly slug: string
  readonly title: string
  readonly Component: ComponentType
}

/** Витрины по порядку components.md. Новые примитивы добавляются сюда. */
export const SHOWCASES: readonly Showcase[] = [
  { slug: 'shell', title: 'Sidebar · shell', Component: ShellShowcase },
  { slug: 'button', title: 'Button', Component: ButtonShowcase },
  { slug: 'field', title: 'Field', Component: FieldShowcase },
  { slug: 'input', title: 'Input', Component: InputShowcase },
  { slug: 'search', title: 'Search', Component: SearchShowcase },
  { slug: 'segmented', title: 'Segmented control', Component: SegmentedShowcase },
  { slug: 'select', title: 'Select / Option', Component: SelectShowcase },
  { slug: 'checkbox', title: 'Checkbox', Component: CheckboxShowcase },
  { slug: 'radio', title: 'Radio', Component: RadioShowcase },
  { slug: 'toggle', title: 'Toggle', Component: ToggleShowcase },
  { slug: 'chip', title: 'Chip', Component: ChipShowcase },
  { slug: 'badge', title: 'Badge · Pill', Component: BadgeShowcase },
  { slug: 'card', title: 'Card', Component: CardShowcase },
  { slug: 'section-header', title: 'Section header', Component: SectionHeaderShowcase },
  { slug: 'table', title: 'Table', Component: TableShowcase },
  { slug: 'progress', title: 'Progress', Component: ProgressShowcase },
  { slug: 'modal', title: 'Modal', Component: ModalShowcase },
  { slug: 'dropzone', title: 'Dropzone', Component: DropzoneShowcase },
  { slug: 'states', title: 'Empty · Error · Skeleton', Component: StatesShowcase },
  { slug: 'section-nav', title: 'SectionNav', Component: SectionNavShowcase },
  { slug: 'formula-stats', title: 'FormulaStats', Component: FormulaStatsShowcase },
  { slug: 'text-link', title: 'TextLink', Component: TextLinkShowcase },
]
