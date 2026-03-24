import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ExtensionApp } from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ExtensionApp />
  </StrictMode>
)
