import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import EnrollPage from './EnrollPage.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EnrollPage />
  </StrictMode>,
)
