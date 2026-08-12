import '@testing-library/jest-dom'
import { vi } from 'vitest'

// jsdom lacks a few browser APIs the app touches during render. Stub the ones
// portals reach for so a render doesn't fail for environmental reasons rather
// than real bugs.
if (typeof window !== 'undefined') {
  // matchMedia (used by some responsive checks)
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as any
  }
  // scrollTo
  if (!window.scrollTo) window.scrollTo = vi.fn() as any
  // canvas getContext (jspdf / qr / image compression touch it)
  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as any
  }
}
