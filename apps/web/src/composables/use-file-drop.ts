import { onBeforeUnmount, onMounted } from 'vue'
import { useTabsStore, type DroppedItem } from '@/stores/tabs'

export function useFileDrop(): void {
  const tabs = useTabsStore()

  function hasFiles(event: DragEvent): boolean {
    return Array.from(event.dataTransfer?.types ?? []).includes('Files')
  }

  function onDragOver(event: DragEvent): void {
    if (!hasFiles(event)) return
    event.preventDefault()
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
  }

  function onDrop(event: DragEvent): void {
    if (!hasFiles(event)) return
    event.preventDefault()
    void tabs.openDroppedItems(readDroppedItems(event))
  }

  function readDroppedItems(event: DragEvent): DroppedItem[] {
    const items = event.dataTransfer?.items
    if (!items?.length) {
      return Array.from(event.dataTransfer?.files ?? []).map((file) => ({
        file,
        isDirectory: false,
      }))
    }
    const dropped: DroppedItem[] = []
    for (const item of Array.from(items)) {
      if (item.kind !== 'file') continue
      const file = item.getAsFile()
      if (!file) continue
      dropped.push({ file, isDirectory: item.webkitGetAsEntry?.()?.isDirectory === true })
    }
    return dropped
  }

  onMounted(() => {
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('dragover', onDragOver)
    window.removeEventListener('drop', onDrop)
  })
}
