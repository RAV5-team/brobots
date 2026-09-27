import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Services } from '@/services'
import { createMockServices } from '@/services/mock'
import { ServicesProvider } from '@/services/ServicesProvider'
import { RoleProvider } from '@/shared/auth/RoleProvider'
import { RobotNewPage } from './RobotNewPage'
import { EMPTY_ROBOT_FORM, type RobotForm } from './robotForm'

const DRAFT_KEY = 'rav5.draft.robot-new.v1'

function CatalogProbe() {
  const { search } = useLocation()
  return <p>{`catalog ${search}`}</p>
}

const renderPage = (role = 'admin', services: Services = createMockServices({ latencyMs: 0 })) =>
  render(
    <MemoryRouter initialEntries={[`/admin/catalog/new?as=${role}`]}>
      <ServicesProvider services={services}>
        <RoleProvider>
          <Routes>
            <Route path="/admin/catalog/new" element={<RobotNewPage />} />
            <Route path="/admin/catalog" element={<CatalogProbe />} />
          </Routes>
        </RoleProvider>
      </ServicesProvider>
    </MemoryRouter>,
  )

const plain = (text: string | null) => (text ?? '').replace(/\u00a0/g, ' ')
const stat = (label: string) => screen.getByText(label).nextSibling

const FILLED: RobotForm = {
  ...EMPTY_ROBOT_FORM,
  name: 'AMR 900',
  manufacturer: 'ООО «Морос»',
  readiness: 'operation',
  trl: '9',
  price: '1 800 000',
  solutionType: 'Мобильные роботы|AMR',
  classes: ['OP-01', 'OP-08'],
  payloadKg: '800',
  dimensions: '940 × 640 × 230',
}

const addPhoto = async (name = 'amr900_front.jpg') => {
  const input = await screen.findByLabelText('Выбрать файлы')
  fireEvent.change(input, { target: { files: [new File(['x'], name, { type: 'image/jpeg' })] } })
}

beforeEach(() => {
  let n = 0
  vi.stubGlobal('URL', Object.assign(URL, {
    createObjectURL: vi.fn(() => `blob:photo-${String(++n)}`),
    revokeObjectURL: vi.fn(),
  }))
})

afterEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('RobotNewPage (экран А2)', () => {
  it('is closed for users: the catalog is kept by the administrator (PRD 5.3)', () => {
    renderPage('user')
    expect(screen.getByText('Раздел недоступен для роли «Пользователь»')).toBeInTheDocument()
  })

  it('renders five sections, the next free id and the readiness rail (PRD 6.3)', async () => {
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Новый робот' })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      '1. Основное и цена', '2. Классы операций и идентификатор', '3. Технические параметры', '4. Условия применения', '5. Фотографии *',
    ])
    expect(screen.getByRole('textbox', { name: /Уникальный идентификатор/ })).toHaveValue('RB-0225')
    expect(stat('Обязательные поля')).toHaveTextContent('1 / 9')
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(10)
    expect(screen.getAllByText('точное значение')).toHaveLength(3)
    expect(screen.getByRole('link', { name: 'Администрирование · Каталог решений' })).toHaveAttribute('href', '/admin/catalog')
  })

  it('counts library processes for checked classes and names the codes in the rail (PRD 15 · №33)', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /OP-01 · Перемещение грузов/ }))
    fireEvent.click(screen.getByRole('button', { name: /OP-08 · Адресная доставка/ }))
    expect(plain(screen.getByText(/Робот попадёт в подбор/).textContent)).toMatch(/^Отмечено 2 класса\. Робот попадёт в подбор для 6 процессов справочника/)
    expect(screen.getByText(/^После сохранения робот появится в «Каталоге» и в подборе/)).toHaveTextContent('с классами OP-01 и OP-08')
    expect(stat('Классы операций')).toHaveTextContent('2')
  })

  it('keeps «Сохранить робота» unavailable until a photo is added; the first photo is the cover (D-18)', async () => {
    renderPage()
    const save = await screen.findByRole('button', { name: 'Сохранить робота' })
    expect(save).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Без фото кнопка «Сохранить робота» недоступна')
    await addPhoto()
    expect(save).toBeEnabled()
    expect(screen.getByRole('img', { name: 'Обложка карточки: amr900_front.jpg' })).toBeInTheDocument()
    expect(screen.getByText('обложка')).toBeInTheDocument()
    expect(stat('Фотографии *')).toHaveTextContent('1')
    fireEvent.click(screen.getByRole('button', { name: 'Убрать фото amr900_front.jpg' }))
    expect(save).toBeDisabled()
  })

  it('shows field errors and a summary instead of saving an incomplete card', async () => {
    renderPage()
    await addPhoto()
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить робота' }))
    expect(await screen.findByText('Проверьте поля с ошибками: 7')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Название/ })).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Отметьте хотя бы один класс — без него робот не попадёт в подбор')).toBeInTheDocument()
  })

  it('rejects a robot already in the catalog: AMR 800 of ООО «Морос» is RB-0008', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...FILLED, name: 'AMR 800' }))
    renderPage()
    await addPhoto()
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить робота' }))
    expect(await screen.findByText(/уже есть в каталоге \(RB-0008\)/)).toBeInTheDocument()
  })

  it('restores the draft, saves the robot and opens А3 «Каталог обновлён» (PRD 6.2)', async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(FILLED))
    const services = createMockServices({ latencyMs: 0 })
    renderPage('admin', services)
    expect(await screen.findByRole('textbox', { name: /Название/ })).toHaveValue('AMR 900')
    expect(await screen.findByText(/^Черновик сохранён · \d\d:\d\d$/)).toBeInTheDocument()
    await addPhoto()
    expect(stat('Обязательные поля')).toHaveTextContent('9 / 9')
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить робота' }))
    expect(await screen.findByText('catalog ?added=RB-0225')).toBeInTheDocument()
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull()
    const saved = await services.catalog.getRobot('RB-0225')
    expect(saved).toMatchObject({ name: 'AMR 900', priceRub: 1_800_000, photos: ['amr900_front.jpg'], specs: { widthMm: 640 } })
  })

  it('writes the draft while typing (D-21)', async () => {
    renderPage()
    fireEvent.change(await screen.findByRole('textbox', { name: /Производитель/ }), { target: { value: 'Ронави' } })
    await waitFor(() => { expect(JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}')).toMatchObject({ manufacturer: 'Ронави' }) })
  })

  it('keeps Excel import and the template unavailable with a hint (PRD 6.4)', async () => {
    renderPage()
    const rail = (await screen.findByText('Готовность карточки')).closest('aside')
    if (!rail) throw new Error('нет панели')
    expect(within(rail).getByRole('button', { name: 'Загрузить из Excel' })).toBeDisabled()
    expect(within(rail).getByRole('button', { name: 'Скачать шаблон' })).toHaveAccessibleDescription(/PRD 6\.4/)
  })
})
