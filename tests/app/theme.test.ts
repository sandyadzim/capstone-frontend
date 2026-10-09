// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { initializeTheme } from '@/app/theme'
import { useThemeStore } from '@/stores/theme-store'

let systemDark = false
let media: MediaQueryList
let dispose: (() => void) | undefined

beforeEach(() => {
  localStorage.clear()
  useThemeStore.setState({ theme: 'system' })
  systemDark = false
  const events = new EventTarget()
  media = {
    get matches() {
      return systemDark
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(events.addEventListener.bind(events)),
    removeEventListener: vi.fn(events.removeEventListener.bind(events)),
    dispatchEvent: events.dispatchEvent.bind(events),
  }
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => media),
  )
})

afterEach(() => {
  dispose?.()
  dispose = undefined
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
})

it.each([
  ['system', false, 'light'],
  ['system', true, 'dark'],
  ['light', true, 'light'],
  ['dark', false, 'dark'],
] as const)(
  'applies %s preference with system dark=%s as %s',
  (theme, matches, expected) => {
    useThemeStore.setState({ theme })
    systemDark = matches
    dispose = initializeTheme()
    expect(window.matchMedia).toHaveBeenCalledWith(
      '(prefers-color-scheme: dark)',
    )
    expect(document.documentElement.classList.contains('dark')).toBe(
      expected === 'dark',
    )
    expect(document.documentElement.style.colorScheme).toBe(expected)
  },
)

it('updates the DOM when the user changes their preference', () => {
  dispose = initializeTheme()
  useThemeStore.getState().setTheme('dark')
  expect(document.documentElement).toHaveClass('dark')
  expect(document.documentElement.style.colorScheme).toBe('dark')
  useThemeStore.getState().setTheme('light')
  expect(document.documentElement).not.toHaveClass('dark')
  expect(document.documentElement.style.colorScheme).toBe('light')
})

it('follows system changes only while system appearance is selected', () => {
  dispose = initializeTheme()
  systemDark = true
  media.dispatchEvent(new Event('change'))
  expect(document.documentElement).toHaveClass('dark')
  useThemeStore.getState().setTheme('light')
  media.dispatchEvent(new Event('change'))
  expect(document.documentElement).not.toHaveClass('dark')
  useThemeStore.getState().setTheme('system')
  expect(document.documentElement).toHaveClass('dark')
  systemDark = false
  media.dispatchEvent(new Event('change'))
  expect(document.documentElement).not.toHaveClass('dark')
})

it('unsubscribes from both preference and media changes on disposal', () => {
  dispose = initializeTheme()
  dispose()
  expect(media.removeEventListener).toHaveBeenCalledWith(
    'change',
    expect.any(Function),
  )
  useThemeStore.getState().setTheme('dark')
  systemDark = true
  media.dispatchEvent(new Event('change'))
  expect(document.documentElement).not.toHaveClass('dark')
  expect(document.documentElement.style.colorScheme).toBe('light')
  dispose = undefined
})
