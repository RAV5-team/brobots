/**
 * Утопленная плитка показателя внутри карточки шага: подпись, значение, необязательное пояснение.
 * Плитки рекомендации подбора (03) и «Проверяем · из подбора» симуляции (04). Разметка — элемент списка `<ul>`.
 */
export function StatTile({ label, value, caption }: { readonly label: string; readonly value: string; readonly caption?: string }) {
  return (
    <li className="flex flex-col gap-4 rounded-lg bg-surface-sunken p-16">
      <span className="type-caption text-text-secondary">{label}</span>
      <span className="type-title-md text-text">{value}</span>
      {caption !== undefined && <span className="type-caption font-medium text-text-secondary">{caption}</span>}
    </li>
  )
}
