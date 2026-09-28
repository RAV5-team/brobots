import { useCallback, useRef, useState } from 'react'
import type { DataSourceUrlCheck } from '@/domain'
import { useServices } from '@/services/useServices'

export type UrlCheckState =
  | { readonly status: 'idle' }
  | { readonly status: 'checking' }
  | { readonly status: 'done'; readonly result: DataSourceUrlCheck }
  | { readonly status: 'failed' }

const IDLE: UrlCheckState = { status: 'idle' }

/**
 * «Проверить» в окне А7б (PRD 6.10): синхронная проверка ссылки до добавления источника.
 * Итог относится к проверенному адресу — правка ссылки сбрасывает его, поздний ответ по старому адресу отбрасывается.
 */
export function useUrlCheck() {
  const { admin } = useServices()
  const [state, setState] = useState<UrlCheckState>(IDLE)
  const requestId = useRef(0)

  const reset = useCallback(() => {
    requestId.current += 1
    setState(IDLE)
  }, [])

  const check = useCallback((url: string) => {
    requestId.current += 1
    const id = requestId.current
    setState({ status: 'checking' })
    admin
      .checkDataSourceUrl(url)
      .then((result) => { if (id === requestId.current) setState({ status: 'done', result }) })
      .catch((error: unknown) => {
        console.error('Не удалось проверить ссылку источника', error)
        if (id === requestId.current) setState({ status: 'failed' })
      })
  }, [admin])

  return { state, check, reset }
}
