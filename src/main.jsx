import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './styles/tailwind.css'
import App from './App.jsx'
import { upgradeAppearanceDefaults } from './app/appearanceUpgrade.js'
import { loadSettings } from './settings/sync.js'
import { queryClient } from './lib/queryClient.js'

// Settings come from data/settings.json first, so the upgrade and the first
// render see the same values in every browser.
await loadSettings()
upgradeAppearanceDefaults()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
