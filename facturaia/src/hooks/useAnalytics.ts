import { useEffect, useRef } from 'react'

// PostHog lazy init — solo se carga si la key está configurada
let posthogInstance: {
  capture: (event: string, props?: Record<string, unknown>) => void
  identify: (id: string, props?: Record<string, unknown>) => void
} | null = null

async function initPostHog() {
  const key = import.meta.env.VITE_POSTHOG_KEY as string | undefined
  const host = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? 'https://app.posthog.com'

  if (!key || posthogInstance) return

  try {
    const { default: posthog } = await import('posthog-js')
    posthog.init(key, { api_host: host, capture_pageview: true })
    posthogInstance = posthog
  } catch (err) {
    console.warn('PostHog no pudo inicializarse:', err)
  }
}

export function useAnalytics() {
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      initPostHog()
    }
  }, [])

  function trackEvent(event: string, properties?: Record<string, unknown>) {
    if (posthogInstance) {
      posthogInstance.capture(event, properties)
    } else {
      // Fallback: log en desarrollo
      if (import.meta.env.DEV) {
        console.log(`[Analytics] ${event}`, properties)
      }
    }
  }

  function identifyUser(userId: string, traits?: Record<string, unknown>) {
    if (posthogInstance) {
      posthogInstance.identify(userId, traits)
    }
  }

  return { trackEvent, identifyUser }
}
