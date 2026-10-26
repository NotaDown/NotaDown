import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron'
import { DESKTOP_MENU_COMMAND_CHANNEL } from '@notadown/shared'

const mocks = vi.hoisted(() => ({
  buildFromTemplate: vi.fn((template: unknown) => template),
  setApplicationMenu: vi.fn(),
}))

vi.mock('electron', () => ({
  app: { isPackaged: true },
  Menu: {
    buildFromTemplate: mocks.buildFromTemplate,
    setApplicationMenu: mocks.setApplicationMenu,
  },
}))

import { installMenu } from '../src/menu'

type Item = MenuItemConstructorOptions

function lastTemplate(): Item[] {
  return mocks.buildFromTemplate.mock.calls.at(-1)?.[0] as Item[]
}

function findMenu(template: Item[], label: string): Item {
  const item = template.find((entry) => entry.label === label)
  if (!item) throw new Error(`menu "${label}" not found`)
  return item
}

function childMenu(template: Item[], menuLabel: string): Item[] {
  return findMenu(template, menuLabel).submenu as Item[]
}

function clickItem(template: Item[], menuLabel: string, label: string): void {
  const item = childMenu(template, menuLabel).find((entry) => entry.label === label)
  if (!item?.click) throw new Error(`item "${label}" not found`)
  ;(item.click as unknown as () => void)()
}

function fakeWindow(destroyed = false) {
  const send = vi.fn()
  const window = {
    isDestroyed: () => destroyed,
    webContents: { send },
  } as unknown as BrowserWindow
  return { window, send }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('installMenu', () => {
  it('installs Chinese labels when the locale is zh-CN', () => {
    installMenu(() => null, 'zh-CN')
    const template = lastTemplate()

    expect(findMenu(template, '文件')).toBeDefined()
    expect(childMenu(template, '文件').map((item) => item.label)).toContain('打开文件…')
    expect(childMenu(template, '编辑').find((item) => item.role === 'undo')?.label).toBe(
      '撤销',
    )
    expect(findMenu(template, '帮助')).toBeDefined()
    expect(template.find((item) => item.role === 'windowMenu')?.label).toBe('窗口')
    expect(mocks.setApplicationMenu).toHaveBeenCalledWith(template)
  })

  it('defaults to English labels', () => {
    installMenu(() => null)
    const template = lastTemplate()

    expect(findMenu(template, 'File')).toBeDefined()
    expect(childMenu(template, 'File').map((item) => item.label)).toContain('Open File…')
    expect(childMenu(template, 'Edit').find((item) => item.role === 'copy')?.label).toBe(
      'Copy',
    )
    expect(template.find((item) => item.role === 'windowMenu')?.label).toBe('Window')
  })

  it('sends commands to the current window', () => {
    const { window, send } = fakeWindow()
    installMenu(() => window, 'en-US')
    const template = lastTemplate()

    clickItem(template, 'File', 'New')
    expect(send).toHaveBeenCalledWith(DESKTOP_MENU_COMMAND_CHANNEL, 'file.new')

    clickItem(template, 'File', 'Open Folder…')
    expect(send).toHaveBeenLastCalledWith(DESKTOP_MENU_COMMAND_CHANNEL, 'file.openWorkspace')

    clickItem(template, 'File', 'Close Folder')
    expect(send).toHaveBeenLastCalledWith(DESKTOP_MENU_COMMAND_CHANNEL, 'file.closeWorkspace')

    clickItem(template, 'View', 'Command Palette…')
    expect(send).toHaveBeenLastCalledWith(DESKTOP_MENU_COMMAND_CHANNEL, 'navigation.palette')

    clickItem(template, 'Help', 'Keyboard Shortcuts')
    expect(send).toHaveBeenLastCalledWith(DESKTOP_MENU_COMMAND_CHANNEL, 'help.shortcuts')
  })

  it('ignores clicks when there is no window', () => {
    installMenu(() => null, 'en-US')
    expect(() => clickItem(lastTemplate(), 'File', 'Save')).not.toThrow()
  })

  it('ignores clicks when the window is destroyed', () => {
    const { window, send } = fakeWindow(true)
    installMenu(() => window, 'en-US')
    clickItem(lastTemplate(), 'File', 'Save')
    expect(send).not.toHaveBeenCalled()
  })
})
