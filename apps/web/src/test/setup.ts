import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Без globals: true Testing Library не очищает DOM сам — рендеры копились бы между тестами.
afterEach(() => {
  cleanup()
  // Роль хранится в sessionStorage (D-24) — между тестами не должна переживать.
  sessionStorage.clear()
})

// В jsdom нет ResizeObserver, а Radix Checkbox меряет им свой размер. Заглушка без измерений.
if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() { /* jsdom ничего не измеряет */ }
    unobserve() { /* jsdom ничего не измеряет */ }
    disconnect() { /* jsdom ничего не измеряет */ }
  }
}

// Radix Select прокручивает к выбранной опции и захватывает указатель — в jsdom этих методов нет.
const element = Element.prototype as Partial<Element>
element.scrollIntoView ??= () => { /* jsdom не прокручивает */ }
element.hasPointerCapture ??= () => false
element.releasePointerCapture ??= () => { /* jsdom не захватывает указатель */ }
