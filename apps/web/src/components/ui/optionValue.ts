/**
 * Radix отдаёт выбранное значение строкой. Берём значение того варианта, которому оно принадлежит, —
 * без приведения к union: чужая строка (её Radix не пришлёт) выбор не меняет.
 */
export function optionValue<T extends string>(options: readonly { readonly value: T }[], value: string): T | undefined {
  return options.find((option) => option.value === value)?.value
}
