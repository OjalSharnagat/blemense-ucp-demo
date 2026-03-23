import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, Compass, Sparkles, X } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getBusinessModeConfig } from '@/lib/businessMode'
import { useBillingStore } from '@/lib/billingStore'
import { useCRMStore } from '@/lib/crmStore'
import { cn } from '@/lib/utils'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

const TOUR_STORAGE_KEY = 'demo-ecom.admin-tour.v1'
const TOUR_OPEN_DELAY_MS = 700
const SPOTLIGHT_PADDING = 12
const PANEL_WIDTH = 360
const PANEL_HEIGHT = 280

type TourStep = {
  id: string
  title: string
  description: string
  route: string
  selector: string
}

type SpotlightRect = {
  top: number
  left: number
  width: number
  height: number
}

type TourContextValue = {
  startTour: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

function readTourStatus(): string | null {
  try {
    return window.localStorage.getItem(TOUR_STORAGE_KEY)
  } catch {
    return null
  }
}

function markTourSeen() {
  try {
    window.localStorage.setItem(TOUR_STORAGE_KEY, 'seen')
  } catch {
    // LocalStorage can be unavailable in privacy-restricted contexts.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function getStepSelector(step: TourStep) {
  return step.selector.startsWith('[data-tour=') ? step.selector : `[data-tour="${step.selector}"]`
}

export function useAdminTour() {
  const context = useContext(TourContext)
  if (!context) {
    throw new Error('useAdminTour must be used within <AdminTourProvider>.')
  }
  return context
}

export function AdminTourProvider({ children }: PropsWithChildren) {
  const location = useLocation()
  const navigate = useNavigate()
  const { businessProfile } = useBillingStore()
  const { settings: crmSettings } = useCRMStore()
  const businessMode = getBusinessModeConfig(businessProfile)

  const [isOpen, setIsOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null)
  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  }))
  const activeTargetRef = useRef<HTMLElement | null>(null)

  const steps = useMemo<TourStep[]>(() => {
    const next: TourStep[] = [
      {
        id: 'dashboard',
        title: 'Dashboard overview',
        description: 'Start with the analytics home to see revenue, orders, and the day at a glance.',
        route: '/admin/dashboard',
        selector: '[data-tour="dashboard-hero"]',
      },
      {
        id: 'products',
        title: 'Product catalog',
        description: 'Add, edit, and keep stock moving from the catalog view.',
        route: '/admin/products',
        selector: '[data-tour="products-add-product"]',
      },
      {
        id: 'orders',
        title: 'Order desk',
        description: 'Filter orders and drill into fulfillment details as they move through the pipeline.',
        route: '/admin/orders',
        selector: '[data-tour="orders-filters"]',
      },
      {
        id: 'customers',
        title: 'Customer directory',
        description: 'Search customers, review purchase history, and keep the relationship clean.',
        route: '/admin/customers',
        selector: '[data-tour="customers-search"]',
      },
      {
        id: 'billing',
        title: 'Billing center',
        description: 'Create invoices and keep document creation close to the collection workflow.',
        route: '/admin/billing',
        selector: '[data-tour="billing-new-document"]',
      },
    ]

    if (businessMode.showGstReturns) {
      next.push({
        id: 'gst-returns',
        title: 'GST returns',
        description: 'Review period-based tax data and export return summaries when GST is enabled.',
        route: '/admin/gst-returns',
        selector: '[data-tour="gst-returns-period"]',
      })
    }

    next.push({
      id: 'crm',
      title: 'CRM home',
      description: 'Track follow-ups, contacts, and customer value from one daily screen.',
      route: '/admin/crm',
      selector: '[data-tour="crm-hero"]',
    })

    if (crmSettings.enableSalesPipeline) {
      next.push({
        id: 'crm-pipeline',
        title: 'Pipeline workspace',
        description: 'Open the pipeline when the team is ready to manage deals or projects.',
        route: '/admin/crm/pipeline',
        selector: '[data-tour="crm-open-pipeline"]',
      })
    }

    next.push(
      {
        id: 'settings',
        title: 'Settings hub',
        description: 'Use settings to jump into business setup, POS behavior, and CRM configuration.',
        route: '/admin/settings',
        selector: '[data-tour="settings-business-setup"]',
      },
      {
        id: 'business-settings',
        title: 'Business setup',
        description: 'Save profile changes that affect invoices, GST visibility, and defaults across the app.',
        route: '/admin/settings/business-gst',
        selector: '[data-tour="business-profile-save"]',
      },
    )

    return next
  }, [
    businessMode.showGstReturns,
    crmSettings.enableSalesPipeline,
  ])

  const closeTour = useCallback(() => {
    setIsOpen(false)
    setStepIndex(0)
    setSpotlightRect(null)
    activeTargetRef.current = null
    markTourSeen()
  }, [])

  const startTour = useCallback(() => {
    markTourSeen()
    setStepIndex(0)
    setIsOpen(true)
  }, [])

  const completeTour = useCallback(() => {
    closeTour()
  }, [closeTour])

  const currentStep = steps[stepIndex] ?? null
  const hasSteps = steps.length > 0

  const nextStep = useCallback(() => {
    if (!hasSteps) return
    if (stepIndex >= steps.length - 1) {
      completeTour()
      return
    }
    setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))
  }, [completeTour, hasSteps, stepIndex, steps.length])

  const prevStep = useCallback(() => {
    if (!hasSteps) return
    setStepIndex((prev) => Math.max(prev - 1, 0))
  }, [hasSteps])

  useEffect(() => {
    if (!location.pathname.startsWith('/admin')) {
      setIsOpen(false)
      setSpotlightRect(null)
      activeTargetRef.current = null
    }
  }, [location.pathname])

  useEffect(() => {
    if (!location.pathname.startsWith('/admin')) return
    if (isOpen) return
    if (readTourStatus()) return

    const timer = window.setTimeout(() => {
      if (readTourStatus()) return
      startTour()
    }, TOUR_OPEN_DELAY_MS)

    return () => window.clearTimeout(timer)
  }, [isOpen, location.pathname, startTour])

  useEffect(() => {
    if (!isOpen || !currentStep) return
    if (location.pathname !== currentStep.route) {
      navigate(currentStep.route, { replace: true })
    }
  }, [currentStep, isOpen, location.pathname, navigate])

  useEffect(() => {
    if (!isOpen || !currentStep) return

    let cancelled = false
    let frameId = 0
    let timeoutId = 0
    let resolved = false

    const measure = () => {
      const element = document.querySelector(getStepSelector(currentStep))
      if (!(element instanceof HTMLElement)) return false

      const rect = element.getBoundingClientRect()
      if (rect.width < 12 || rect.height < 12) return false

      activeTargetRef.current = element
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })

      const pad = SPOTLIGHT_PADDING
      resolved = true
      window.clearTimeout(timeoutId)
      setSpotlightRect({
        top: clamp(rect.top - pad, 8, viewport.height - 8),
        left: clamp(rect.left - pad, 8, viewport.width - 8),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      })
      return true
    }

    const tick = () => {
      if (cancelled) return
      if (measure()) return
      frameId = window.requestAnimationFrame(tick)
    }

    timeoutId = window.setTimeout(() => {
      if (cancelled || resolved) return
      nextStep()
    }, 4500)

    setSpotlightRect(null)
    activeTargetRef.current = null
    tick()

    return () => {
      cancelled = true
      if (frameId) window.cancelAnimationFrame(frameId)
      window.clearTimeout(timeoutId)
    }
  }, [currentStep, isOpen, nextStep, viewport.height, viewport.width])

  useEffect(() => {
    if (!isOpen || !activeTargetRef.current) return

    const update = () => {
      const element = activeTargetRef.current
      if (!element) return
      const rect = element.getBoundingClientRect()
      const pad = SPOTLIGHT_PADDING
      setSpotlightRect({
        top: clamp(rect.top - pad, 8, viewport.height - 8),
        left: clamp(rect.left - pad, 8, viewport.width - 8),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)

    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null
    if (observer) observer.observe(activeTargetRef.current)

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
      observer?.disconnect()
    }
  }, [isOpen, viewport.height, viewport.width, stepIndex])

  useEffect(() => {
    const onResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    if (stepIndex < steps.length) return
    setStepIndex(Math.max(steps.length - 1, 0))
  }, [isOpen, stepIndex, steps.length])

  const panelStyle = useMemo(() => {
    if (!isOpen || !spotlightRect) {
      return viewport.width < 768
        ? {
            left: 12,
            right: 12,
            bottom: 12,
          }
        : {
            left: viewport.width - PANEL_WIDTH - 16,
            top: viewport.height - PANEL_HEIGHT - 16,
          }
    }

    if (viewport.width < 768) {
      return {
        left: 12,
        right: 12,
        bottom: 12,
      }
    }

    const preferRight = spotlightRect.left + spotlightRect.width + PANEL_WIDTH + 28 < viewport.width
    const left = preferRight
      ? spotlightRect.left + spotlightRect.width + 20
      : spotlightRect.left - PANEL_WIDTH - 20
    const top = clamp(spotlightRect.top - 8, 16, viewport.height - PANEL_HEIGHT - 16)

    return {
      left: clamp(left, 16, Math.max(16, viewport.width - PANEL_WIDTH - 16)),
      top,
    }
  }, [isOpen, spotlightRect, viewport.height, viewport.width])

  const contextValue = useMemo(() => ({ startTour }), [startTour])
  const visibleStepNumber = Math.min(stepIndex + 1, Math.max(steps.length, 1))

  return (
    <TourContext.Provider value={contextValue}>
      {children}
      {isOpen && currentStep && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[70]">
          {spotlightRect ? (
            <>
              <button
                type="button"
                aria-label="Skip product tour"
                className="fixed left-0 top-0 z-[70] bg-slate-950/72"
                style={{ height: spotlightRect.top, width: '100vw' }}
                onClick={closeTour}
              />
              <button
                type="button"
                aria-label="Skip product tour"
                className="fixed z-[70] bg-slate-950/72"
                style={{
                  top: spotlightRect.top,
                  left: 0,
                  width: spotlightRect.left,
                  height: spotlightRect.height,
                }}
                onClick={closeTour}
              />
              <button
                type="button"
                aria-label="Skip product tour"
                className="fixed z-[70] bg-slate-950/72"
                style={{
                  top: spotlightRect.top,
                  left: spotlightRect.left + spotlightRect.width,
                  width: Math.max(0, viewport.width - (spotlightRect.left + spotlightRect.width)),
                  height: spotlightRect.height,
                }}
                onClick={closeTour}
              />
              <button
                type="button"
                aria-label="Skip product tour"
                className="fixed left-0 z-[70] bg-slate-950/72"
                style={{
                  top: spotlightRect.top + spotlightRect.height,
                  height: Math.max(0, viewport.height - (spotlightRect.top + spotlightRect.height)),
                  width: '100vw',
                }}
                onClick={closeTour}
              />
              <div
                className="fixed z-[75] rounded-2xl border border-white/35 shadow-[0_0_0_1px_rgba(255,255,255,0.25),0_0_0_9999px_rgba(15,23,42,0.18)] ring-1 ring-sky-400/50"
                style={{
                  top: spotlightRect.top,
                  left: spotlightRect.left,
                  width: spotlightRect.width,
                  height: spotlightRect.height,
                  pointerEvents: 'none',
                }}
              />
            </>
          ) : (
            <div className="fixed inset-0 bg-slate-950/72" onClick={closeTour} />
          )}

          <div
            role="dialog"
            aria-label="Admin product tour"
            className={cn(
              'fixed z-[80] w-[min(92vw,22.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-slate-950 text-white shadow-[0_24px_80px_rgba(15,23,42,0.45)]',
              viewport.width < 768 ? 'min-h-[18rem]' : 'min-h-[17rem]'
            )}
            style={panelStyle}
          >
            <Card className="border-0 bg-transparent text-inherit shadow-none">
              <CardHeader className="space-y-3 border-b border-white/10 bg-white/5 px-5 py-4">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="secondary" className="border-white/10 bg-white/10 text-white">
                    Step {visibleStepNumber} of {steps.length}
                  </Badge>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-white hover:bg-white/10 hover:text-white"
                    onClick={closeTour}
                    aria-label="Close tour"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.24em] text-sky-200/80">
                  <Compass className="h-3.5 w-3.5" />
                  Guided tour
                </div>
                <div>
                  <CardTitle className="text-xl text-white">{currentStep.title}</CardTitle>
                  <CardDescription className="mt-2 text-sm leading-6 text-slate-300">
                    {currentStep.description}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 px-5 py-4">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                  Opened from <span className="font-medium text-white">{currentStep.route.replace('/admin/', '')}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-2 text-white hover:bg-white/10 hover:text-white"
                    onClick={prevStep}
                    disabled={stepIndex === 0}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-slate-300 hover:bg-white/10 hover:text-white"
                      onClick={closeTour}
                    >
                      Skip tour
                    </Button>
                    <Button
                      type="button"
                      className="gap-2 bg-white text-slate-950 hover:bg-slate-100"
                      onClick={nextStep}
                    >
                      {stepIndex >= steps.length - 1 ? 'Finish' : 'Next'}
                      {stepIndex >= steps.length - 1 ? <Sparkles className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>,
        document.body
      )}
    </TourContext.Provider>
  )
}
