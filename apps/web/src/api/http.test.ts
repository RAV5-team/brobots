import { describe, expect, it, vi } from 'vitest'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  UnavailableError,
  ValidationError,
} from '@/services/errors'
import { buildUrl, createHttpClient, toServiceError } from './http'

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('buildUrl', () => {
  it('drops empty values and joins lists with commas', () => {
    expect(buildUrl('/api/v1', '/solutions', { kind: 'robot', ids: ['a', 'b'], q: '', limit: 0, empty: [] }))
      .toBe('/api/v1/solutions?kind=robot&ids=a%2Cb&limit=0')
  })
})

describe('toServiceError', () => {
  it.each([
    [400, ValidationError],
    [401, UnauthorizedError],
    [403, ForbiddenError],
    [404, NotFoundError],
    [409, ConflictError],
    [422, ValidationError],
    [503, UnavailableError],
  ])('maps %i', (status, type) => {
    expect(toServiceError(status, { detail: 'x' })).toBeInstanceOf(type)
  })

  it('prefers the first field message and keeps the machine code', () => {
    const error = toServiceError(409, { detail: 'Конфликт', code: 'project_saved' })
    expect(error).toMatchObject({ message: 'Конфликт', code: 'project_saved' })
    const invalid = toServiceError(422, { detail: 'Проверьте поля', errors: [{ field: 'name', message: 'Поле «Название» не заполнено' }] })
    expect(invalid).toMatchObject({ message: 'Поле «Название» не заполнено', fields: [{ field: 'name', message: 'Поле «Название» не заполнено' }] })
  })
})

describe('createHttpClient', () => {
  it('sends the bearer token and JSON body', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json(200, { id: '1' }))
    const http = createHttpClient({ baseUrl: '/api/v1', getToken: () => Promise.resolve('t0k'), fetch })
    await expect(http.post('/projects', { name: 'Проект' })).resolves.toEqual({ id: '1' })
    const [url, init] = fetch.mock.calls[0] ?? []
    expect(url).toBe('/api/v1/projects')
    const headers = new Headers(init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer t0k')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(init?.body).toBe('{"name":"Проект"}')
  })

  it('goes as a guest without a token and returns undefined on 204', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    const http = createHttpClient({ baseUrl: '/api/v1', getToken: () => Promise.resolve(null), fetch })
    await expect(http.delete('/tasks/1')).resolves.toBeUndefined()
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).has('Authorization')).toBe(false)
  })

  it('reuses a GET that is already in flight and fetches again after it settles', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(() => Promise.resolve(json(200, { ok: true })))
    const http = createHttpClient({ baseUrl: '/api/v1', fetch })
    const [first, second] = await Promise.all([http.get('/projects', { limit: 500 }), http.get('/projects', { limit: 500 })])
    expect(first).toEqual({ ok: true })
    expect(second).toBe(first)
    expect(fetch).toHaveBeenCalledOnce()
    await http.get('/projects', { limit: 500 })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not reuse a GET that failed', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json(500, { detail: 'нет' }))
      .mockResolvedValueOnce(json(200, { ok: true }))
    const http = createHttpClient({ baseUrl: '', fetch })
    await expect(http.get('/projects')).rejects.toThrow()
    await expect(http.get('/projects')).resolves.toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('reports 401 and a network failure', async () => {
    const onUnauthorized = vi.fn()
    const unauthorized = createHttpClient({
      baseUrl: '',
      onUnauthorized,
      fetch: () => Promise.resolve(json(401, { code: 'unauthorized', message: 'Требуется вход' })),
    })
    await expect(unauthorized.get('/projects')).rejects.toThrow(UnauthorizedError)
    expect(onUnauthorized).toHaveBeenCalledOnce()

    const offline = createHttpClient({ baseUrl: '', fetch: () => Promise.reject(new TypeError('Failed to fetch')) })
    await expect(offline.get('/projects')).rejects.toThrow(UnavailableError)
  })
})
