const MARGIN = 8
const GAP = 8
const MAX_GROUPS_HEIGHT = 420
const PIN_FRAMES = 6
const OBSERVE_OPTIONS: MutationObserverInit = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['data-show', 'style'],
}

interface MenuAnchor {
  top: number
  right: number
  left: number
}

/*
 * Crepe positions the slash menu against the window and scrolls the document when
 * the add button is pressed. Keep the menu at the nearest fully visible spot beside
 * the block handle and leave the document scroll position untouched.
 */
export function keepSlashMenuInView(editor: HTMLElement): () => void {
  const content = editor.querySelector<HTMLElement>('.milkdown')
  let frame: number | null = null
  let observer: MutationObserver | null = null
  let groupsMaxHeight = ''
  let anchor: MenuAnchor | null = null
  let pinFrame: number | null = null
  let pinTop = 0
  let pinLeft = 0
  let pinFrames = PIN_FRAMES
  let shown = false

  const holdScroll = (): void => {
    pinTop = editor.scrollTop
    pinLeft = editor.scrollLeft
    pinFrames = 0
    if (pinFrame !== null) window.cancelAnimationFrame(pinFrame)
    const tick = (): void => {
      pinFrame = null
      if (pinFrames >= PIN_FRAMES) return
      pinFrames += 1
      if (editor.scrollTop !== pinTop) editor.scrollTop = pinTop
      if (editor.scrollLeft !== pinLeft) editor.scrollLeft = pinLeft
      pinFrame = window.requestAnimationFrame(tick)
    }
    pinFrame = window.requestAnimationFrame(tick)
  }

  // Restoring inside the scroll event keeps the jump out of the painted frame.
  const onScroll = (): void => {
    if (pinFrames >= PIN_FRAMES) return
    if (editor.scrollTop !== pinTop) editor.scrollTop = pinTop
    if (editor.scrollLeft !== pinLeft) editor.scrollLeft = pinLeft
  }

  const onPointerDown = (event: PointerEvent): void => {
    const target = event.target
    if (!(target instanceof Element) || !content) return
    const item = target.closest('.operation-item')
    const handle = item?.closest<HTMLElement>('.milkdown-block-handle')
    if (!item || !handle || item !== handle.firstElementChild) return
    const rect = handle.getBoundingClientRect()
    const box = content.getBoundingClientRect()
    const originTop = box.top + content.clientTop
    const originLeft = box.left + content.clientLeft
    anchor = {
      top: rect.top - originTop,
      right: rect.right - originLeft,
      left: rect.left - originLeft,
    }
    holdScroll()
  }

  const place = (menu: HTMLElement): void => {
    if (!content) return
    const bounds = editor.getBoundingClientRect()
    const minTop = bounds.top + MARGIN
    const maxBottom = bounds.bottom - MARGIN
    const minLeft = bounds.left + MARGIN
    const maxRight = bounds.right - MARGIN

    const groups = menu.querySelector<HTMLElement>('.menu-groups')
    if (groups) {
      const style = window.getComputedStyle(menu)
      const chrome =
        Number.parseFloat(style.paddingTop) +
        Number.parseFloat(style.paddingBottom) +
        Number.parseFloat(style.borderTopWidth) +
        Number.parseFloat(style.borderBottomWidth) +
        (menu.querySelector<HTMLElement>('.tab-group')?.offsetHeight ?? 0)
      const available = Math.max(0, maxBottom - minTop)
      const maxHeight = `${Math.max(0, Math.min(MAX_GROUPS_HEIGHT, Math.floor(available - chrome)))}px`
      if (groupsMaxHeight !== maxHeight) {
        groupsMaxHeight = maxHeight
        groups.style.maxHeight = maxHeight
      }
    }

    const box = content.getBoundingClientRect()
    const originTop = box.top + content.clientTop
    const originLeft = box.left + content.clientLeft
    const width = menu.offsetWidth
    const height = menu.offsetHeight

    let top: number
    let left: number
    if (anchor) {
      top = anchor.top + originTop
      left = anchor.right + originLeft + GAP
    } else {
      const styledTop = Number.parseFloat(menu.style.top)
      const styledLeft = Number.parseFloat(menu.style.left)
      if (!Number.isFinite(styledTop) || !Number.isFinite(styledLeft)) return
      top = styledTop + originTop
      left = styledLeft + originLeft
    }

    if (left + width > maxRight) {
      left = anchor ? anchor.left + originLeft - GAP - width : maxRight - width
    }
    left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxRight - width))
    top = Math.min(Math.max(top, minTop), Math.max(minTop, maxBottom - height))

    const nextTop = `${Math.round(top - originTop)}px`
    const nextLeft = `${Math.round(left - originLeft)}px`
    if (menu.style.top !== nextTop) menu.style.top = nextTop
    if (menu.style.left !== nextLeft) menu.style.left = nextLeft
  }

  const clamp = (): void => {
    frame = null
    const menu = editor.querySelector<HTMLElement>('.milkdown-slash-menu')
    if (!menu || menu.dataset.show !== 'true') return

    // Disconnect while writing so our own style changes do not retrigger the observer.
    observer?.disconnect()
    try {
      place(menu)
    } finally {
      observer?.observe(editor, OBSERVE_OPTIONS)
    }
  }

  const schedule = (): void => {
    if (frame !== null) return
    frame = window.requestAnimationFrame(clamp)
  }

  observer = new MutationObserver((records) => {
    const menu = editor.querySelector<HTMLElement>('.milkdown-slash-menu')
    if (!menu) return
    const visible = menu.dataset.show === 'true'
    if (shown && !visible) anchor = null
    shown = visible
    if (!visible) return
    if (records.some((record) => record.target === menu || menu.contains(record.target))) {
      schedule()
    }
  })
  observer.observe(editor, OBSERVE_OPTIONS)
  editor.addEventListener('pointerdown', onPointerDown, true)
  editor.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', schedule)

  return () => {
    observer?.disconnect()
    observer = null
    editor.removeEventListener('pointerdown', onPointerDown, true)
    editor.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', schedule)
    if (frame !== null) window.cancelAnimationFrame(frame)
    if (pinFrame !== null) window.cancelAnimationFrame(pinFrame)
  }
}
