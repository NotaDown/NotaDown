import { useI18n } from 'vue-i18n'
import { basename } from '@notadown/shared'
import { platform } from '@/platform'
import { describeError } from '@/errors'
import { useSettingsStore } from '@/stores/settings'
import { useTabsStore } from '@/stores/tabs'
import { useUiStore } from '@/stores/ui'
import { useWorkspaceStore } from '@/stores/workspace'

export function useDeleteEntry(): {
  removeEntry: (path: string, kind: 'file' | 'directory') => Promise<void>
} {
  const { t } = useI18n()
  const settings = useSettingsStore()
  const tabs = useTabsStore()
  const ui = useUiStore()
  const workspace = useWorkspaceStore()

  async function removeEntry(path: string, kind: 'file' | 'directory'): Promise<void> {
    if (settings.settings.confirmDelete) {
      const message =
        kind === 'directory'
          ? t('tree.confirmDeleteFolder')
          : platform.capabilities.revealInFolder
            ? t('tree.confirmDeleteFile')
            : t('tree.confirmDeletePermanent')
      const confirmed = await ui.confirm({
        title: t('tree.confirmDeleteTitle', { name: basename(path) }),
        message,
        confirmLabel: t('common.delete'),
        cancelLabel: t('common.cancel'),
        danger: true,
      })
      if (!confirmed) return
    }
    try {
      await workspace.deleteEntry(path)
      tabs.markDeleted(path, kind === 'directory')
      ui.toast('success', t('tree.deleted', { name: basename(path) }))
    } catch (error) {
      ui.toast('error', t('errors.generic'), describeError(error))
    }
  }

  return { removeEntry }
}
