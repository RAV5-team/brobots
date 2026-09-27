// Источник: экраны 06 (И. Демидов, меню кабинета, строка версий в шапке), А1 (А. Соколова), «12 · Подбор» первой итерации (гость); PRD 4, 5.2.
import type { DataVersion, Profile, Role } from '@/domain'

export const PROFILES: Readonly<Record<Role, Profile>> = {
  user: { role: 'user', name: 'И. Демидов', initials: 'ИД', email: 'demo@rav5.ru', organization: 'Демо-организация' },
  admin: { role: 'admin', name: 'А. Соколова', initials: 'АС', email: 'admin@rav5.ru', organization: 'Демо-организация' },
  guest: { role: 'guest', name: 'Гость', initials: 'Г', email: null, organization: null },
}

export const DATA_VERSION: DataVersion = { source: 'ФЦ БАС', catalog: 'v4', model: '2.1', snapshotDate: '2026-09-15' }
