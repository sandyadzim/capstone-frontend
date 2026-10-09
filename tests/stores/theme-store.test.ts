// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  vi.resetModules()
})

it('defaults to system appearance without a saved preference', async () => {
  const { useThemeStore } = await import('@/stores/theme-store')
  expect(useThemeStore.getState().theme).toBe('system')
})

it.each(['light', 'dark', 'system'])(
  'hydrates the saved %s preference and retains its action',
  async (theme) => {
    localStorage.setItem(
      'property-appearance',
      JSON.stringify({ state: { theme }, version: 0 }),
    )
    const { useThemeStore } = await import('@/stores/theme-store')
    expect(useThemeStore.getState().theme).toBe(theme)
    useThemeStore.getState().setTheme('dark')
    expect(useThemeStore.getState().theme).toBe('dark')
  },
)

it.each([{ theme: 'sepia' }, { theme: null }, {}, null])(
  'ignores an invalid persisted preference %j',
  async (state) => {
    localStorage.setItem(
      'property-appearance',
      JSON.stringify({ state, version: 0 }),
    )
    const { useThemeStore } = await import('@/stores/theme-store')
    expect(useThemeStore.getState().theme).toBe('system')
  },
)

it('recovers from corrupt saved JSON', async () => {
  localStorage.setItem('property-appearance', '{broken')
  const { useThemeStore } = await import('@/stores/theme-store')
  expect(useThemeStore.getState().theme).toBe('system')
  useThemeStore.getState().setTheme('light')
  expect(
    JSON.parse(localStorage.getItem('property-appearance') ?? 'null'),
  ).toEqual({ state: { theme: 'light' }, version: 0 })
})

it('persists only the preference, which survives a fresh module load', async () => {
  const { useThemeStore } = await import('@/stores/theme-store')
  useThemeStore.getState().setTheme('dark')
  expect(
    JSON.parse(localStorage.getItem('property-appearance') ?? 'null'),
  ).toEqual({ state: { theme: 'dark' }, version: 0 })
  vi.resetModules()
  const reloaded = await import('@/stores/theme-store')
  expect(reloaded.useThemeStore.getState().theme).toBe('dark')
})

it('removes the persisted preference when storage is cleared', async () => {
  const { useThemeStore } = await import('@/stores/theme-store')
  useThemeStore.getState().setTheme('dark')
  useThemeStore.persist.clearStorage()
  expect(localStorage.getItem('property-appearance')).toBeNull()
})

it('keeps in-memory appearance usable when storage reads, writes, and removal are blocked', async () => {
  for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
    vi.spyOn(Storage.prototype, method).mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
  }
  const { useThemeStore } = await import('@/stores/theme-store')
  expect(useThemeStore.getState().theme).toBe('system')
  expect(() => useThemeStore.getState().setTheme('dark')).not.toThrow()
  expect(useThemeStore.getState().theme).toBe('dark')
  expect(() => useThemeStore.persist.clearStorage()).not.toThrow()
})
