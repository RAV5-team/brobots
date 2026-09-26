import { ru } from '@/shared/i18n/ru'

/** Плашка демо-режима в шапке проекта у гостя (PRD 5.3; D-14). */
export function DemoBanner() {
  return (
    <p role="status" className="inline-flex h-24 items-center rounded-full bg-accent-surface px-10 type-caption font-medium text-on-accent">
      {ru.demo.banner}
    </p>
  )
}
