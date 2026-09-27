import { ru } from '@/shared/i18n/ru'

const t = ru.ui.multiSelect

/** Подпись кнопки: «Отрасль» → «Отрасль: Промышленность» → «Отрасль: 3» (PRD 7.4). */
export function multiSelectButtonLabel<T extends string>(label: string, selected: readonly T[], all: readonly { readonly value: T; readonly label: string; readonly buttonLabel?: string | undefined }[]): string {
  if (selected.length === 0) return label
  if (selected.length > 1) return t.many(label, selected.length)
  const option = all.find((o) => o.value === selected[0])
  return t.one(label, option?.buttonLabel ?? option?.label ?? selected[0] ?? '')
}

