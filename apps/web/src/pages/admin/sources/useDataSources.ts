import { useCallback, useEffect, useState } from 'react'
import type { DataSource, DataSourceRefresh } from '@/domain'
import { useServices } from '@/services/useServices'
import { formatDayOf } from '@/shared/format'
import { ru } from '@/shared/i18n/ru'

const t = ru.dataSources

export type DataSourcesState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly sources: readonly DataSource[] }

export interface DataSourcesModel {
  readonly state: DataSourcesState
  /** Ключи источников, по которым идёт запрос: их кнопка и переключатель заблокированы. */
  readonly pending: ReadonlySet<string>
  /** Итог последнего действия для живой области: «обновлён» или текст ошибки. */
  readonly notice: string
  readonly retry: () => void
  readonly setRefresh: (source: DataSource, refresh: DataSourceRefresh) => void
  readonly refresh: (source: DataSource) => void
  /** Источник из окна А7 уже сохранён сервисом: дописать его в реестр и объявить. */
  readonly added: (source: DataSource) => void
}

const withKey = (keys: ReadonlySet<string>, key: string) => new Set([...keys, key])
const withoutKey = (keys: ReadonlySet<string>, key: string) => new Set([...keys].filter((k) => k !== key))

/** Данные экрана А6: реестр источников, переключение автообновления, «Обновить» по строке и новый источник из А7 (PRD 6.9, 6.10). */
export function useDataSources(): DataSourcesModel {
  const services = useServices()
  const [state, setState] = useState<DataSourcesState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let cancelled = false
    services.admin.listDataSources()
      .then((sources) => { if (!cancelled) setState({ status: 'ready', sources }) })
      .catch((error: unknown) => {
        if (cancelled) return
        console.error('Не удалось загрузить источники данных', error)
        setState({ status: 'error' })
      })
    return () => { cancelled = true }
  }, [services, attempt])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((n) => n + 1)
  }, [])

  // Общая обвязка запроса по строке: блокировка, замена источника ответом, сообщение об итоге.
  const run = useCallback((source: DataSource, request: Promise<DataSource>, done: (next: DataSource) => string, failed: string) => {
    setPending((keys) => withKey(keys, source.key))
    setNotice('')
    request
      .then((next) => {
        setState((current) => current.status === 'ready'
          ? { status: 'ready', sources: current.sources.map((s) => (s.key === next.key ? next : s)) }
          : current)
        setNotice(done(next))
      })
      .catch((error: unknown) => {
        console.error(`Действие с источником ${source.key} не выполнено`, error)
        setNotice(failed)
      })
      .finally(() => { setPending((keys) => withoutKey(keys, source.key)) })
  }, [])

  const setRefresh = useCallback((source: DataSource, refresh: DataSourceRefresh) => {
    run(source, services.admin.updateDataSource(source.key, { refresh }), () => '', t.updateFailed(source.name))
  }, [run, services])

  const refresh = useCallback((source: DataSource) => {
    run(source, services.admin.refreshDataSource(source.key), (next) => t.refreshed(next.name, formatDayOf(next.actualizedOn)), t.refreshFailed(source.name))
  }, [run, services])

  const added = useCallback((source: DataSource) => {
    setState((current) => current.status === 'ready' ? { status: 'ready', sources: [...current.sources, source] } : current)
    setNotice(t.added(source.name))
  }, [])

  return { state, pending, notice, retry, setRefresh, refresh, added }
}
