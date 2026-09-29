import type { ComponentType } from 'react'
import { ShellShowcase } from './ShellShowcase'
import { ButtonShowcase, FieldShowcase, InputShowcase, SearchShowcase } from './buttonsAndFieldsShowcases'
import { CheckboxShowcase, RadioShowcase, SegmentedShowcase, SelectShowcase } from './choiceControlsShowcases'
import { BadgeShowcase, ChipShowcase, ToggleShowcase } from './togglesAndTagsShowcases'
import { CardShowcase, ProgressShowcase, SectionHeaderShowcase, TableShowcase } from './surfacesShowcases'
import { DropzoneShowcase, FileInputShowcase, ModalShowcase, StatesShowcase } from './overlaysAndStatesShowcases'
import { CharacteristicRowShowcase, ChipListShowcase, CompareTableShowcase, MultiSelectShowcase, RadioTableShowcase } from './catalogShowcases'
import { FormulaStatsShowcase, SectionNavShowcase, StatusBannerShowcase, TabNavShowcase, TextLinkShowcase } from './navigationAndStatusShowcases'
import { FieldGridShowcase, HourGridShowcase, NumberStepperShowcase, StepperShowcase } from './projectFormShowcases'
import { ChartsShowcase } from './chartShowcases'
import { TimeWindowListShowcase } from './timeWindowShowcases'
import { DisclosureShowcase, PopoverShowcase, ScorePillShowcase, TabsShowcase } from './disclosureShowcases'
import { ProjectStepLayoutShowcase } from './projectStepLayoutShowcases'
import { FormRailShowcase, NumberFieldShowcase } from './formShowcases'
import { PageHeaderShowcase, StatTileShowcase, WellShowcase } from './tileShowcases'

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
  { slug: 'number-field', title: 'NumberField', Component: NumberFieldShowcase },
  { slug: 'search', title: 'Search', Component: SearchShowcase },
  { slug: 'segmented', title: 'Segmented control', Component: SegmentedShowcase },
  { slug: 'select', title: 'Select / Option', Component: SelectShowcase },
  { slug: 'multi-select', title: 'MultiSelectFilter', Component: MultiSelectShowcase },
  { slug: 'checkbox', title: 'Checkbox', Component: CheckboxShowcase },
  { slug: 'radio', title: 'Radio', Component: RadioShowcase },
  { slug: 'radio-table', title: 'RadioTable', Component: RadioTableShowcase },
  { slug: 'toggle', title: 'Toggle', Component: ToggleShowcase },
  { slug: 'chip', title: 'Chip', Component: ChipShowcase },
  { slug: 'chip-list', title: 'ChipList · MoreChip', Component: ChipListShowcase },
  { slug: 'badge', title: 'Badge · Pill', Component: BadgeShowcase },
  { slug: 'card', title: 'Card', Component: CardShowcase },
  { slug: 'stat-tile', title: 'StatTile', Component: StatTileShowcase },
  { slug: 'well', title: 'Well', Component: WellShowcase },
  { slug: 'page-header', title: 'PageHeader', Component: PageHeaderShowcase },
  { slug: 'form-rail', title: 'FormRail', Component: FormRailShowcase },
  { slug: 'section-header', title: 'Section header', Component: SectionHeaderShowcase },
  { slug: 'table', title: 'Table', Component: TableShowcase },
  { slug: 'compare-table', title: 'CompareTable · FitCell', Component: CompareTableShowcase },
  { slug: 'characteristic-row', title: 'CharacteristicRow · StatusChip', Component: CharacteristicRowShowcase },
  { slug: 'progress', title: 'Progress', Component: ProgressShowcase },
  { slug: 'modal', title: 'Modal', Component: ModalShowcase },
  { slug: 'popover', title: 'Popover', Component: PopoverShowcase },
  { slug: 'disclosure', title: 'Disclosure', Component: DisclosureShowcase },
  { slug: 'tabs', title: 'Tabs', Component: TabsShowcase },
  { slug: 'score-pill', title: 'ScorePill', Component: ScorePillShowcase },
  { slug: 'dropzone', title: 'Dropzone', Component: DropzoneShowcase },
  { slug: 'file-input', title: 'FileInput', Component: FileInputShowcase },
  { slug: 'states', title: 'Empty · Error · Skeleton', Component: StatesShowcase },
  { slug: 'section-nav', title: 'SectionNav', Component: SectionNavShowcase },
  { slug: 'formula-stats', title: 'FormulaStats', Component: FormulaStatsShowcase },
  { slug: 'text-link', title: 'TextLink', Component: TextLinkShowcase },
  { slug: 'tab-nav', title: 'TabNav', Component: TabNavShowcase },
  { slug: 'status-banner', title: 'StatusBanner', Component: StatusBannerShowcase },
  { slug: 'stepper', title: 'Stepper', Component: StepperShowcase },
  { slug: 'number-stepper', title: 'NumberStepper', Component: NumberStepperShowcase },
  { slug: 'project-step-layout', title: 'ProjectStepLayout', Component: ProjectStepLayoutShowcase },
  { slug: 'field-grid', title: 'FieldGrid', Component: FieldGridShowcase },
  { slug: 'hour-grid', title: 'HourGrid', Component: HourGridShowcase },
  { slug: 'time-window-list', title: 'TimeWindowList', Component: TimeWindowListShowcase },
  { slug: 'charts', title: 'Charts', Component: ChartsShowcase },
]
