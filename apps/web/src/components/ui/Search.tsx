import { Search as SearchIcon } from 'lucide-react'
import type { InputHTMLAttributes } from 'react'
import { Input } from './Input'

interface SearchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  /** Подпись для чтения с экрана и подсказка в поле: «Найти процесс». */
  readonly label: string
}

/** Поиск по списку (components.md: Search; 15935:280). Символ «⌕» заменён иконкой (D-03). */
export function Search({ label, placeholder, ...rest }: SearchProps) {
  return <Input type="search" aria-label={label} placeholder={placeholder ?? label} leading={<SearchIcon size={16} />} {...rest} />
}
