import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from './lib/theme'
import { UnitsProvider } from './lib/units'
import { NotificationSoundProvider } from './lib/notificationSound'
import { DropOffProvider } from './lib/dropOff'
import { TranscriberProvider } from './lib/transcriber'
import { ErrorBoundary } from './components/ErrorBoundary'
import App from './App'
import './index.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element #root not found')

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
})

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <UnitsProvider>
          <NotificationSoundProvider>
            <DropOffProvider>
              <TranscriberProvider>
                <App />
              </TranscriberProvider>
            </DropOffProvider>
          </NotificationSoundProvider>
        </UnitsProvider>
      </ThemeProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
