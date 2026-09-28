import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnavailableError,
  ValidationError,
  type FieldIssue,
} from '@/services/errors'

type QueryValue = string | number | boolean | readonly string[] | null | undefined
export type Query = Readonly<Record<string, QueryValue>>

/** Клиент services/api: пути — от `/api/v1`, ответ — JSON схемы из api.d.ts, ошибки — классы services/errors. */
export interface HttpClient {
  get<T>(path: string, query?: Query): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  put<T>(path: string, body?: unknown): Promise<T>
  patch<T>(path: string, body?: unknown): Promise<T>
  delete<T = void>(path: string): Promise<T>
  /** multipart/form-data: загрузка файлов. */
  upload<T>(path: string, form: FormData): Promise<T>
}

export interface HttpClientOptions {
  /** `/api/v1` или `https://host/api/v1`. */
  readonly baseUrl: string
  readonly getToken?: () => Promise<string | null>
  /** 401: сессия истекла или токен не принят. */
  readonly onUnauthorized?: () => void
  readonly fetch?: typeof fetch
}

/** Тело ошибки: RFC 7807 services/api или `{code, message}` проверки токена. */
interface ProblemBody {
  readonly title?: string
  readonly detail?: string
  readonly message?: string
  readonly code?: string
  readonly errors?: readonly { readonly field?: string; readonly message?: string; readonly hint?: string }[]
}

const FALLBACK_MESSAGE = 'Не удалось выполнить запрос, попробуйте ещё раз'
const NETWORK_MESSAGE = 'Сервис недоступен. Проверьте подключение и повторите'

export function buildUrl(baseUrl: string, path: string, query?: Query): string {
  const params = new URLSearchParams()
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(','))
      return
    }
    params.set(key, String(value))
  })
  const search = params.toString()
  return `${baseUrl}${path}${search ? `?${search}` : ''}`
}

async function readProblem(response: Response): Promise<ProblemBody> {
  try {
    const body: unknown = await response.json()
    return typeof body === 'object' && body !== null ? body : {}
  } catch {
    return {}
  }
}

function fieldIssues(problem: ProblemBody): readonly FieldIssue[] {
  return (problem.errors ?? []).map((e) => ({
    field: e.field ?? '',
    message: e.message ?? '',
    ...(e.hint ? { hint: e.hint } : {}),
  }))
}

/** Ответ с ошибкой → класс ошибки, который понимают экраны. Текст — от сервиса, на русском. */
export function toServiceError(status: number, problem: ProblemBody): Error {
  const fields = fieldIssues(problem)
  const message = fields[0]?.message || problem.detail || problem.message || problem.title || FALLBACK_MESSAGE
  const code = problem.code ?? null
  switch (status) {
    case 400:
    case 422:
      return new ValidationError(message, fields)
    case 401:
      return new UnauthorizedError(message)
    case 403:
      return new ForbiddenError(message, code)
    case 404:
      return new NotFoundError(message)
    case 409:
      return new ConflictError(message, code)
    case 503:
      return new UnavailableError(message, code)
    default:
      return new Error(message)
  }
}

export function createHttpClient({ baseUrl, getToken, onUnauthorized, fetch: fetchImpl }: HttpClientOptions): HttpClient {
  const doFetch = fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))

  async function request<T>(method: string, path: string, init: { query?: Query; body?: unknown; form?: FormData } = {}): Promise<T> {
    const headers = new Headers({ Accept: 'application/json' })
    const token = getToken ? await getToken() : null
    if (token) headers.set('Authorization', `Bearer ${token}`)
    let body: BodyInit | undefined
    if (init.form) {
      body = init.form
    } else if (init.body !== undefined) {
      headers.set('Content-Type', 'application/json')
      body = JSON.stringify(init.body)
    }

    let response: Response
    try {
      response = await doFetch(buildUrl(baseUrl, path, init.query), { method, headers, ...(body === undefined ? {} : { body }) })
    } catch {
      throw new UnavailableError(NETWORK_MESSAGE, 'network')
    }

    if (!response.ok) {
      const error = toServiceError(response.status, await readProblem(response))
      if (error instanceof UnauthorizedError) onUnauthorized?.()
      throw error
    }
    if (response.status === 204) return undefined as T
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  return {
    get: (path, query) => request('GET', path, query ? { query } : {}),
    post: (path, body) => request('POST', path, { body }),
    put: (path, body) => request('PUT', path, { body }),
    patch: (path, body) => request('PATCH', path, { body }),
    delete: (path) => request('DELETE', path),
    upload: (path, form) => request('POST', path, { form }),
  }
}
