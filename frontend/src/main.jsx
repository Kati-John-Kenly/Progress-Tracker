import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ClerkProvider } from '@clerk/react'
import App from './App.jsx'
import './index.css'
import './utils/appInstall.js'
import { applyAppTheme, getStoredTheme } from './utils/workspaceEvents'
import { initializePersistentStorage } from './utils/persistentStorage'
import { initializeAppUpdates } from './utils/appUpdates'

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const registerAppUpdates = () => {
    initializeAppUpdates().catch((error) => {
      console.error('Progress service worker registration failed:', error)
    })
  }
  if (document.readyState === 'complete') registerAppUpdates()
  else window.addEventListener('load', registerAppUpdates, { once: true })
}

const startApplication = async () => {
  await initializePersistentStorage()
  applyAppTheme(getStoredTheme())

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      {clerkPublishableKey ? (
        <ClerkProvider publishableKey={clerkPublishableKey}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ClerkProvider>
      ) : (
        <BrowserRouter>
          <App />
        </BrowserRouter>
      )}
    </React.StrictMode>,
  )
}

startApplication().catch((error) => {
  console.error('Progress could not start:', error)
  document.getElementById('root').textContent = 'Progress could not start. Please reload the app.'
})
