import { onBeforeUnmount, onMounted, ref } from 'vue'

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function usePwaInstall() {
  const available = ref(false)
  let promptEvent: InstallPromptEvent | null = null

  function onBeforeInstallPrompt(event: Event): void {
    event.preventDefault()
    promptEvent = event as InstallPromptEvent
    available.value = true
  }

  function onInstalled(): void {
    promptEvent = null
    available.value = false
  }

  async function install(): Promise<void> {
    if (!promptEvent) return
    const prompt = promptEvent
    promptEvent = null
    available.value = false
    await prompt.prompt()
    await prompt.userChoice
  }

  onMounted(() => {
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onInstalled)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.removeEventListener('appinstalled', onInstalled)
  })

  return { available, install }
}
