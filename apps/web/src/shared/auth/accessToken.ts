/** Кто выдаёт access token для запросов к API: вход Keycloak регистрирует себя здесь. */
export type AccessTokenProvider = () => Promise<string | null>

let provider: AccessTokenProvider | null = null

export function setAccessTokenProvider(next: AccessTokenProvider | null): void {
  provider = next
}

/** Текущий токен со свежим сроком действия; null — гость (или вход без Keycloak). */
export function getAccessToken(): Promise<string | null> {
  return provider ? provider() : Promise.resolve(null)
}
