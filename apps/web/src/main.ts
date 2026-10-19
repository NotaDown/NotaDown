import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { i18n } from './i18n'
import { bootstrapTheme } from './theme'
import '@notadown/editor/styles.css'
import './styles/base.css'

bootstrapTheme()

const app = createApp(App)
app.use(createPinia())
app.use(i18n)
app.mount('#app')

if (import.meta.env.PROD && !window.notadown && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(new URL('sw.js', document.baseURI))
      .catch(() => undefined)
  })
}
