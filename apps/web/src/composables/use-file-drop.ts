import { onBeforeUnmount, onMounted } from 'vue'
import { useTabsStore } from '@/stores/tabs'

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
    const files = Array.from(event.dataTransfer?.files ?? [])
    void tabs.openDroppedFiles(files)
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
