import type { ComponentType } from 'react'
import type { Project } from '@/domain'

/** Props шага проекта (02–08): каркас `ProjectStepPage` отдаёт шагу проект, название локации и роль. */
export interface ProjectStepProps {
  readonly project: Project
  readonly locationName: string
  readonly isGuest: boolean
}

/** Компонент шага: грузится отдельным чанком по маршруту шага (router.tsx). */
export type ProjectStepComponent = ComponentType<ProjectStepProps>
