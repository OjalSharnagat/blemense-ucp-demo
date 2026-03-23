import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Activity,
  ArrowDownUp,
  ChevronRight,
  CircleDollarSign,
  Edit3,
  LayoutGrid,
  ListFilter,
  Plus,
  Search,
  Table2,
  Target,
  TimerReset,
  UserRound,
  X
} from 'lucide-react'
import { useCRMStore } from '@/lib/crmStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { INDIAN_STATES } from '@/data/gst'
import {
  crmDate,
  crmDateTime,
  crmMoney,
  dealStageAccent,
  dealStageLabel,
  getDealTerminology,
  getContactAvatarClass,
  getContactDisplayName,
  getContactInitials,
  panelClassName,
  stageVariant
} from './shared'
import type { Contact, Deal } from '@/data/crm'
import type { InvoiceType } from '@/data/billing'

type ViewMode = 'kanban' | 'table'
type SortField = 'stage' | 'value' | 'closeDate' | 'probability' | 'daysInStage' | 'contact' | 'updatedAt'
type SortDirection = 'asc' | 'desc'
type DealFormState = {
  title: string
  contactId: string
  value: string
  stage: Deal['stage']
  probability: string
  expectedCloseDate: string
  assignedTo: string
  notes: string
}
type ActivityFormState = {
  type: 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP' | 'DEMO' | 'SITE_VISIT' | 'FOLLOW_UP' | 'NOTE' | 'TASK'
  subject: string
  description: string
  outcome: string
  scheduledAt: string
}
type LossFormState = {
  reason: string
  notes: string
}
type InvoicePrefill = {
  crmContactId?: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  contactCompany?: string
  contactAddress?: string
  contactCity?: string
  contactState?: string
  contactStateCode?: string
  contactPincode?: string
  contactGstin?: string
  contactPan?: string
  dealId?: string
  dealTitle?: string
  dealValue?: number
  invoiceType?: InvoiceType
}

const VIEW_STORAGE_KEY = 'blemense-crm-pipeline-view'
const STAGE_STORAGE_KEY = 'blemense-crm-stage-threshold'
const todayStart = new Date()
todayStart.setHours(0, 0, 0, 0)

const LOSS_REASONS = ['Price', 'Competitor', 'Timing', 'No response', 'Budget', 'Scope mismatch', 'Other']

const initialDealForm = (defaultStage: Deal['stage'], defaultContactId = ''): DealFormState => ({
  title: '',
  contactId: defaultContactId,
  value: '',
  stage: defaultStage,
  probability: '25',
  expectedCloseDate: '',
  assignedTo: '',
  notes: ''
})

const initialActivityForm = (): ActivityFormState => ({
  type: 'FOLLOW_UP',
  subject: '',
  description: '',
  outcome: '',
  scheduledAt: ''
})

function normalize(value: string | undefined | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeDigits(value: string | undefined | null): string {
  return String(value ?? '').replace(/\D/g, '')
}

function isOpenStage(stage: Deal['stage']): boolean {
  return !stage.startsWith('CLOSED')
}

function daysBetween(start?: string, end = new Date()): number {
  if (!start) return 0
  const startDate = new Date(start)
  if (Number.isNaN(startDate.getTime())) return 0
  return Math.max(0, Math.floor((end.getTime() - startDate.getTime()) / 86400000))
}

function dueDateStatus(date?: string): 'ok' | 'overdue' | 'none' {
  if (!date) return 'none'
  const ts = new Date(date).getTime()
  if (Number.isNaN(ts)) return 'none'
  return ts < todayStart.getTime() ? 'overdue' : 'ok'
}

function formatDate(date?: string): string {
  if (!date) return 'TBD'
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return 'TBD'
  return crmDate.format(parsed)
}

function buildInvoicePrefill(contact: Contact, deal: Deal): InvoicePrefill {
  return {
    crmContactId: contact.id,
    contactName: contact.displayName || getContactDisplayName(contact),
    contactPhone: contact.phone || contact.whatsapp,
    contactEmail: contact.email,
    contactCompany: contact.company,
    contactAddress: contact.address,
    contactCity: contact.city,
    contactState: contact.state,
    contactStateCode: contact.state
      ? INDIAN_STATES.find((state) => state.name.trim().toLowerCase() === contact.state?.trim().toLowerCase())?.tinCode || ''
      : '',
    contactPincode: contact.pincode,
    contactGstin: contact.gstin,
    contactPan: contact.pan,
    dealId: deal.id,
    dealTitle: deal.title,
    dealValue: deal.value,
    invoiceType: 'TAX_INVOICE'
  }
}

export default function PipelineView() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    deals,
    contacts,
    settings,
    createDeal,
    updateDeal,
    moveDealStage,
    closeDeal,
    logActivity
  } = useCRMStore()
  const showTeamFeatures = settings.enableTeamFeatures
  const dealTerm = getDealTerminology(settings)

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'kanban'
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
    return stored === 'table' ? 'table' : 'kanban'
  })
  const [stageThreshold, setStageThreshold] = useState<number>(() => {
    if (typeof window === 'undefined') return 14
    const stored = window.localStorage.getItem(STAGE_STORAGE_KEY)
    return Number.isFinite(Number(stored)) ? Math.max(1, Number(stored)) : 14
  })
  const [search, setSearch] = useState('')
  const [assignedFilter, setAssignedFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [closeFrom, setCloseFrom] = useState('')
  const [closeTo, setCloseTo] = useState('')
  const [sortField, setSortField] = useState<SortField>('value')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null)
  const [dragTargetStage, setDragTargetStage] = useState<Deal['stage'] | null>(null)
  const [dealModalOpen, setDealModalOpen] = useState(false)
  const [editingDealId, setEditingDealId] = useState<string | null>(null)
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [activityDealId, setActivityDealId] = useState<string | null>(null)
  const [winDealId, setWinDealId] = useState<string | null>(null)
  const [lossDealId, setLossDealId] = useState<string | null>(null)
  const [dealSearch, setDealSearch] = useState('')
  const [lossForm, setLossForm] = useState<LossFormState>({ reason: '', notes: '' })
  const [dealForm, setDealForm] = useState<DealFormState>(() => initialDealForm(settings.dealStages[0] ?? 'LEAD'))
  const [activityForm, setActivityForm] = useState<ActivityFormState>(() => initialActivityForm())

  const activeStage = searchParams.get('stage')
  const filteredStage = settings.dealStages.includes(activeStage as typeof settings.dealStages[number])
    ? (activeStage as typeof settings.dealStages[number])
    : ''

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode)
    }
  }, [viewMode])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STAGE_STORAGE_KEY, String(stageThreshold))
    }
  }, [stageThreshold])

  const contactById = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts])

  const dealSummaries = useMemo(() => {
    const q = search.trim().toLowerCase()
    const fromTs = closeFrom ? new Date(closeFrom).setHours(0, 0, 0, 0) : null
    const toTs = closeTo ? new Date(closeTo).setHours(23, 59, 59, 999) : null

    return deals
      .map((deal) => {
        const contact = contactById.get(deal.contactId)
        const combinedTags = [...deal.tags, ...(contact?.tags ?? [])]
        const expectedCloseTs = deal.expectedCloseDate ? new Date(deal.expectedCloseDate).getTime() : null
        const matchesCloseRange =
          (!fromTs || (expectedCloseTs !== null && expectedCloseTs >= fromTs)) &&
          (!toTs || (expectedCloseTs !== null && expectedCloseTs <= toTs))

        return {
          deal,
          contact,
          score: deal.value * (deal.probability / 100),
          daysInStage: daysBetween(deal.stageChangedAt || deal.updatedAt || deal.createdAt),
          combinedTags
        }
      })
      .filter(({ deal, contact, combinedTags, score }) => {
        if (filteredStage && deal.stage !== filteredStage) return false
        if (showTeamFeatures && assignedFilter !== 'ALL' && (deal.assignedTo || '') !== assignedFilter) return false
        if (sourceFilter !== 'ALL' && (deal.source || '') !== sourceFilter) return false
        if (tagFilter.length && !tagFilter.every((tag) => combinedTags.includes(tag))) return false

        const matchesSearch =
          !q ||
          [
            deal.title,
            getContactDisplayName(contact || ({} as Contact)),
            contact?.company,
            showTeamFeatures ? deal.assignedTo : '',
            deal.source,
            deal.tags.join(' ')
          ]
            .filter(Boolean)
            .some((value) => normalize(String(value)).includes(q))

        return matchesSearch && score >= 0
      })
      .filter(({ deal, contact }) => {
        if (!deal.expectedCloseDate) return !closeFrom && !closeTo
        const ts = new Date(deal.expectedCloseDate).getTime()
        return !Number.isNaN(ts) && (!closeFrom || ts >= new Date(closeFrom).setHours(0, 0, 0, 0)) && (!closeTo || ts <= new Date(closeTo).setHours(23, 59, 59, 999))
      })
  }, [assignedFilter, closeFrom, closeTo, contactById, deals, filteredStage, search, sourceFilter, tagFilter, showTeamFeatures])

  const availableTags = useMemo(() => {
    return [...new Set(dealSummaries.flatMap(({ deal, contact }) => [...deal.tags, ...(contact?.tags ?? [])]).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    )
  }, [dealSummaries])

  const availableAssignees = useMemo(() => {
    return [...new Set(deals.map((deal) => deal.assignedTo).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b))
  }, [deals])

  const availableSources = useMemo(() => {
    return [...new Set(deals.map((deal) => deal.source).filter((value): value is Deal['source'] => Boolean(value)))].sort((a, b) => String(a).localeCompare(String(b)))
  }, [deals])

  const visibleDeals = useMemo(() => {
    const sorted = [...dealSummaries]
    const direction = sortDirection === 'asc' ? 1 : -1

    sorted.sort((a, b) => {
      if (sortField === 'stage') return direction * a.deal.stage.localeCompare(b.deal.stage)
      if (sortField === 'value') return direction * (a.deal.value - b.deal.value)
      if (sortField === 'closeDate') return direction * ((new Date(a.deal.expectedCloseDate || 0).getTime() || 0) - (new Date(b.deal.expectedCloseDate || 0).getTime() || 0))
      if (sortField === 'probability') return direction * (a.deal.probability - b.deal.probability)
      if (sortField === 'daysInStage') return direction * (a.daysInStage - b.daysInStage)
      if (sortField === 'contact') {
        const left = a.contact ? getContactDisplayName(a.contact) : ''
        const right = b.contact ? getContactDisplayName(b.contact) : ''
        return direction * left.localeCompare(right)
      }
      return direction * (new Date(a.deal.updatedAt).getTime() - new Date(b.deal.updatedAt).getTime())
    })

    return sorted
  }, [dealSummaries, sortDirection, sortField])

  const stageColumns = useMemo(() => {
    const stages = filteredStage ? [filteredStage] : settings.dealStages
    return stages.map((stage) => {
      const stageDeals = visibleDeals.filter(({ deal }) => deal.stage === stage)
      return {
        stage,
        deals: stageDeals,
        count: stageDeals.length,
        value: stageDeals.reduce((sum, item) => sum + item.deal.value, 0),
        weighted: stageDeals.reduce((sum, item) => sum + item.deal.value * (item.deal.probability / 100), 0)
      }
    })
  }, [filteredStage, settings.dealStages, visibleDeals])

  const totalPipelineValue = useMemo(() => {
    return visibleDeals
      .filter(({ deal }) => isOpenStage(deal.stage))
      .reduce((sum, item) => sum + item.deal.value, 0)
  }, [visibleDeals])

  const weightedPipelineValue = useMemo(() => {
    return visibleDeals
      .filter(({ deal }) => isOpenStage(deal.stage))
      .reduce((sum, item) => sum + item.deal.value * (item.deal.probability / 100), 0)
  }, [visibleDeals])

  const closingThisMonth = useMemo(() => {
    const month = new Date().getMonth()
    const year = new Date().getFullYear()
    return visibleDeals.filter(({ deal }) => {
      if (!deal.expectedCloseDate || !isOpenStage(deal.stage)) return false
      const dt = new Date(deal.expectedCloseDate)
      return !Number.isNaN(dt.getTime()) && dt.getMonth() === month && dt.getFullYear() === year
    }).length
  }, [visibleDeals])

  const openDealCount = useMemo(() => visibleDeals.filter(({ deal }) => isOpenStage(deal.stage)).length, [visibleDeals])

  const stageSummary = stageColumns.map((column) => ({
    ...column,
    label: dealStageLabel[column.stage]
  }))

  const resetDealForm = (stage = settings.dealStages[0] ?? 'LEAD', contactId = '') => {
    setDealForm(initialDealForm(stage, contactId))
    setDealSearch('')
  }

  const openAddDeal = (stage: Deal['stage'] = settings.dealStages[0] ?? 'LEAD') => {
    setEditingDealId(null)
    resetDealForm(stage)
    setDealModalOpen(true)
  }

  const openEditDeal = (dealId: string) => {
    const source = deals.find((deal) => deal.id === dealId)
    if (!source) return
    setEditingDealId(dealId)
    setDealForm({
      title: source.title,
      contactId: source.contactId,
      value: String(source.value),
      stage: source.stage,
      probability: String(source.probability),
      expectedCloseDate: source.expectedCloseDate || '',
      assignedTo: showTeamFeatures ? source.assignedTo || '' : '',
      notes: source.notes || ''
    })
    setDealSearch(contactById.get(source.contactId) ? getContactDisplayName(contactById.get(source.contactId)!) : '')
    setDealModalOpen(true)
  }

  const selectedDeal = editingDealId ? deals.find((deal) => deal.id === editingDealId) ?? null : null
  const winningDeal = winDealId ? deals.find((deal) => deal.id === winDealId) ?? null : null
  const losingDeal = lossDealId ? deals.find((deal) => deal.id === lossDealId) ?? null : null
  const activityDeal = activityDealId ? deals.find((deal) => deal.id === activityDealId) ?? null : null

  const filteredContactOptions = useMemo(() => {
    const q = dealSearch.trim().toLowerCase()
    return contacts
      .filter((contact) => {
        if (!q) return true
        return [
          getContactDisplayName(contact),
          contact.company,
          contact.phone,
          contact.email,
          contact.assignedTo
        ]
          .filter(Boolean)
          .some((value) => normalize(String(value)).includes(q))
      })
      .slice(0, 24)
  }, [contacts, dealSearch])

  const handleDealDrop = (dealId: string, stage: Deal['stage']) => {
    const deal = deals.find((item) => item.id === dealId)
    if (!deal || deal.stage === stage) return

    if (stage === 'CLOSED_WON') {
      moveDealStage(dealId, stage)
      setWinDealId(dealId)
      return
    }

    if (stage === 'CLOSED_LOST') {
      setLossDealId(dealId)
      setLossForm({ reason: '', notes: '' })
      return
    }

    moveDealStage(dealId, stage)
  }

  const handleSaveDeal = () => {
    const contact = contactById.get(dealForm.contactId)
    if (!contact) return

    const payload = {
      title: dealForm.title.trim(),
      contactId: dealForm.contactId,
      value: Number(dealForm.value || 0),
      currency: 'INR',
      stage: dealForm.stage,
      probability: Math.max(0, Math.min(100, Number(dealForm.probability || 0))),
      expectedCloseDate: dealForm.expectedCloseDate || undefined,
      assignedTo: showTeamFeatures ? dealForm.assignedTo.trim() || undefined : undefined,
      productIds: [] as string[],
      notes: dealForm.notes.trim() || undefined,
      source: contact.source,
      tags: contact.tags,
      activities: [] as string[]
    }

    if (editingDealId) {
      const existing = deals.find((deal) => deal.id === editingDealId)
      if (!existing) return

      if (existing.stage !== payload.stage) {
        if (payload.stage === 'CLOSED_WON') {
          moveDealStage(existing.id, 'CLOSED_WON')
        } else if (payload.stage === 'CLOSED_LOST') {
          closeDeal(existing.id, false, 'Moved from edit flow')
        } else {
          moveDealStage(existing.id, payload.stage)
        }
      }

      updateDeal({
        ...existing,
        title: payload.title || existing.title,
        contactId: payload.contactId,
        value: payload.value,
        probability: payload.probability,
        expectedCloseDate: payload.expectedCloseDate,
        assignedTo: showTeamFeatures ? payload.assignedTo : undefined,
        notes: payload.notes,
        source: payload.source,
        tags: payload.tags
      })
    } else {
      createDeal(payload)
    }

    setDealModalOpen(false)
    setEditingDealId(null)
  }

  const handleLogActivity = () => {
    const deal = activityDeal
    if (!deal) return

    const now = new Date().toISOString()
    logActivity({
      type: activityForm.type,
      contactId: deal.contactId,
      dealId: deal.id,
      subject: activityForm.subject.trim() || `${deal.title} follow-up`,
      description: activityForm.description.trim() || undefined,
      outcome: activityForm.outcome.trim() || undefined,
      scheduledAt: activityForm.scheduledAt || undefined,
      completedAt: activityForm.type === 'NOTE' || activityForm.type === 'CALL' || activityForm.type === 'MEETING' || activityForm.type === 'WHATSAPP' ? now : undefined,
      status: activityForm.scheduledAt ? 'SCHEDULED' : 'COMPLETED',
      createdBy: settings.defaultAssignee,
      attachments: []
    })
    setActivityModalOpen(false)
    setActivityDealId(null)
    setActivityForm(initialActivityForm())
  }

  const confirmLoss = () => {
    if (!losingDeal || !lossForm.reason.trim()) return
    const closed = closeDeal(losingDeal.id, false, lossForm.reason.trim())
    if (closed && lossForm.notes.trim()) {
      updateDeal({
        ...closed,
        notes: closed.notes ? `${closed.notes}\n\nLoss notes: ${lossForm.notes.trim()}` : `Loss notes: ${lossForm.notes.trim()}`
      })
    }
    setLossDealId(null)
    setLossForm({ reason: '', notes: '' })
  }

  const createInvoiceFromDeal = (invoiceType: InvoiceType = 'TAX_INVOICE') => {
    if (!winningDeal) return
    const contact = contactById.get(winningDeal.contactId)
    if (!contact) return
    navigate('/admin/billing/new', { state: { ...buildInvoicePrefill(contact, winningDeal), invoiceType } })
  }

  const stageAgeClass = (days: number) => (days > stageThreshold ? 'text-amber-700' : 'text-muted-foreground')

  const renderDealCard = (summary: (typeof visibleDeals)[number], compact = false) => {
    const { deal, contact, daysInStage } = summary
    const overdue = deal.stage !== 'CLOSED_WON' && deal.stage !== 'CLOSED_LOST' && dueDateStatus(deal.expectedCloseDate) === 'overdue'
    const contactName = contact ? getContactDisplayName(contact) : 'Unknown contact'
    const company = contact?.company || deal.source || 'No company'
    const assigned = deal.assignedTo || 'Unassigned'
    const assignedAvatar = getContactAvatarClass(assigned)
    const initials = getContactInitials(assigned || 'Assignee')

    return (
      <Card
        key={deal.id}
        draggable
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', deal.id)
          setDraggedDealId(deal.id)
        }}
        onDragEnd={() => {
          setDraggedDealId(null)
          setDragTargetStage(null)
        }}
        className={panelClassName(
          cn(
            'border-l-4 transition',
            draggedDealId === deal.id ? 'scale-[0.99] opacity-70' : '',
            compact ? 'shadow-sm' : ''
          )
        )}
        style={{ borderLeftColor: dealStageAccent[deal.stage] }}
      >
        <CardContent className={cn('space-y-3 p-4', compact ? 'p-3' : '')}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{contactName}</p>
              <p className="truncate text-xs text-muted-foreground">{company}</p>
            </div>
            <Badge variant={stageVariant(deal.stage)}>{deal.probability}%</Badge>
          </div>

          <div className="space-y-1">
            <p className="text-base font-semibold leading-tight">{deal.title}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{crmMoney.format(deal.value)}</p>
          </div>

          <div className="grid gap-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Expected close</span>
              <span className={cn('font-medium', overdue ? 'text-rose-600' : 'text-foreground')}>{formatDate(deal.expectedCloseDate)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Days in stage</span>
              <span className={cn('font-medium', stageAgeClass(daysInStage))}>{daysInStage} days</span>
            </div>
          </div>

          {showTeamFeatures ? (
            <div className="flex items-center justify-between gap-2 rounded-2xl border bg-background/70 p-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold', assignedAvatar)}>{initials}</div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Assigned to</p>
                  <p className="truncate text-sm font-medium">{assigned}</p>
                </div>
              </div>
              <Button type="button" size="sm" variant="ghost" asChild className="shrink-0 px-2">
                <Link to={`/admin/crm/contacts/${deal.contactId}`}>
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" className="w-full justify-center px-2" onClick={() => { setActivityDealId(deal.id); setActivityForm(initialActivityForm()); setActivityModalOpen(true) }} title="Log activity">
              <Activity className="h-4 w-4" />
              <span className="sr-only">Log activity</span>
            </Button>
            <Button type="button" variant="outline" size="sm" className="w-full justify-center px-2" onClick={() => openEditDeal(deal.id)} title={`Edit ${dealTerm.singular.toLowerCase()}`}>
              <Edit3 className="h-4 w-4" />
              <span className="sr-only">Edit {dealTerm.singular.toLowerCase()}</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderStageColumn = (stage: Deal['stage']) => {
    const column = stageColumns.find((entry) => entry.stage === stage)
    if (!column) return null

    return (
      <div
        key={stage}
        className={cn('space-y-3 rounded-3xl border p-3 transition', dragTargetStage === stage ? 'border-primary bg-primary/5' : 'bg-background/50')}
        onDragOver={(event) => {
          event.preventDefault()
          setDragTargetStage(stage)
        }}
        onDragLeave={() => setDragTargetStage((current) => (current === stage ? null : current))}
        onDrop={(event) => {
          event.preventDefault()
          const dealId = event.dataTransfer.getData('text/plain') || draggedDealId
          if (dealId) handleDealDrop(dealId, stage)
          setDraggedDealId(null)
          setDragTargetStage(null)
        }}
      >
        <Card className={panelClassName()}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <Badge variant={stageVariant(stage)}>{dealStageLabel[stage]}</Badge>
              <CardTitle className="text-base">{column.count} {dealTerm.plural.toLowerCase()}</CardTitle>
                <CardDescription>{crmMoney.format(column.value)} total</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-9 w-9 shrink-0 p-0"
                onClick={() => openAddDeal(stage)}
                title={`Add ${dealTerm.singular.toLowerCase()} to ${dealStageLabel[stage]}`}
              >
                <Plus className="h-4 w-4" />
                <span className="sr-only">Add {dealTerm.singular.toLowerCase()}</span>
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="space-y-3">
          {column.deals.length ? (
            column.deals
              .slice()
              .sort((a, b) => {
                const overdueA = dueDateStatus(a.deal.expectedCloseDate) === 'overdue' ? 1 : 0
                const overdueB = dueDateStatus(b.deal.expectedCloseDate) === 'overdue' ? 1 : 0
                if (overdueA !== overdueB) return overdueB - overdueA
                if (a.deal.value !== b.deal.value) return b.deal.value - a.deal.value
                return daysBetween(a.deal.expectedCloseDate) - daysBetween(b.deal.expectedCloseDate)
              })
              .map((summary) => renderDealCard(summary))
          ) : (
            <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No {dealTerm.plural.toLowerCase()} in this stage.
            </div>
          )}
        </div>
      </div>
    )
  }

  const tableRows = visibleDeals
    .map((summary) => summary)
    .sort((a, b) => {
      const direction = sortDirection === 'asc' ? 1 : -1
      if (sortField === 'stage') return direction * a.deal.stage.localeCompare(b.deal.stage)
      if (sortField === 'value') return direction * (a.deal.value - b.deal.value)
      if (sortField === 'closeDate') return direction * ((new Date(a.deal.expectedCloseDate || 0).getTime() || 0) - (new Date(b.deal.expectedCloseDate || 0).getTime() || 0))
      if (sortField === 'probability') return direction * (a.deal.probability - b.deal.probability)
      if (sortField === 'daysInStage') return direction * (a.daysInStage - b.daysInStage)
      if (sortField === 'contact') {
        const left = a.contact ? getContactDisplayName(a.contact) : ''
        const right = b.contact ? getContactDisplayName(b.contact) : ''
        return direction * left.localeCompare(right)
      }
      return direction * (new Date(a.deal.updatedAt).getTime() - new Date(b.deal.updatedAt).getTime())
    })

  const selectDealContact = (contactId: string) => {
    setDealForm((prev) => ({ ...prev, contactId }))
  }

  const clearFilters = () => {
    setSearch('')
    setAssignedFilter('ALL')
    setSourceFilter('ALL')
    setTagFilter([])
    setCloseFrom('')
    setCloseTo('')
  }

  if (!settings.enableSalesPipeline) {
    return (
      <div className="dash-view space-y-6">
        <Card className={panelClassName()}>
          <CardContent className="space-y-4 p-6">
            <Badge variant="secondary">Sales pipeline disabled</Badge>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Contacts-first CRM mode</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                This business is set up to focus on contacts and activities first. Enable Sales Pipeline in CRM Settings when you want to track
                {` ${dealTerm.plural.toLowerCase()}`} and manual outreach in a board view.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/admin/crm/settings">Open CRM Settings</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/admin/crm/contacts">Open Contacts</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="dash-view space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{dealTerm.plural} Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            A Kanban board for {dealTerm.plural.toLowerCase()} with drag/drop, list view, and fast follow-up actions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => openAddDeal(filteredStage || settings.dealStages[0] || 'LEAD')}>
            <Plus className="mr-2 h-4 w-4" />
            New {dealTerm.singular}
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/crm/contacts">
              <Target className="mr-2 h-4 w-4" />
              Contacts
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-3">
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total pipeline value</p>
            <p className="mt-2 text-2xl font-semibold">{crmMoney.format(totalPipelineValue)}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Weighted pipeline value</p>
            <p className="mt-2 text-2xl font-semibold">{crmMoney.format(weightedPipelineValue)}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{dealTerm.plural} closing this month</p>
            <p className="mt-2 text-2xl font-semibold">{closingThisMonth}</p>
          </CardContent>
        </Card>
      </div>

      <Card className={panelClassName()}>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Filters</CardTitle>
              <CardDescription>Search and slice the board by owner, source, tags, or expected close date.</CardDescription>
            </div>
            <div className="flex items-center gap-2 rounded-xl border bg-muted/20 p-1">
              <Button type="button" variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                Kanban
              </Button>
              <Button type="button" variant={viewMode === 'table' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('table')}>
                <Table2 className="mr-2 h-4 w-4" />
                Table
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn('grid gap-3', showTeamFeatures ? 'xl:grid-cols-[1.2fr_repeat(3,minmax(0,0.9fr))]' : 'xl:grid-cols-[1.2fr_repeat(2,minmax(0,0.9fr))]')}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search deal, contact, company, tag" />
            </div>
            {showTeamFeatures ? (
              <Select value={assignedFilter} onChange={(event) => setAssignedFilter(event.target.value)}>
                <option value="ALL">All assignees</option>
                {availableAssignees.map((assignee) => (
                  <option key={assignee} value={assignee}>
                    {assignee}
                  </option>
                ))}
              </Select>
            ) : null}
            <Select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="ALL">All sources</option>
              {availableSources.map((source) => (
                <option key={source || 'unknown'} value={source || ''}>
                  {source || 'Unknown'}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <Input type="date" value={closeFrom} onChange={(event) => setCloseFrom(event.target.value)} />
              <Input type="date" value={closeTo} onChange={(event) => setCloseTo(event.target.value)} />
            </div>
          </div>

          <div className={cn('grid gap-3', showTeamFeatures ? 'xl:grid-cols-[1.2fr_1fr_0.8fr]' : 'xl:grid-cols-[1.2fr_1fr]')}>
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Tag filter</p>
              <select
                multiple
                size={Math.min(6, Math.max(3, availableTags.length || 3))}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={tagFilter}
                onChange={(event) => setTagFilter(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}
              >
                {availableTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">Hold Ctrl/Command to pick more than one tag.</p>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected tags</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tagFilter.length ? (
                  tagFilter.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">None selected</span>
                )}
              </div>
            </div>
            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Stage age threshold</p>
                  <p className="mt-2 text-sm text-muted-foreground">Cards turn amber when a deal sits too long in one stage.</p>
                </div>
                <div className="w-24">
                  <Input type="number" min={1} value={stageThreshold} onChange={(event) => setStageThreshold(Math.max(1, Number(event.target.value || 1)))} />
                </div>
              </div>
            </div>
          </div>

          {(search || assignedFilter !== 'ALL' || sourceFilter !== 'ALL' || tagFilter.length || closeFrom || closeTo || filteredStage) ? (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/20 p-3 text-sm text-muted-foreground">
              <Badge variant="secondary">Filtered</Badge>
              <span>{visibleDeals.length} {dealTerm.plural.toLowerCase()} visible</span>
              <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={clearFilters}>
                <X className="mr-2 h-4 w-4" />
                Clear
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {viewMode === 'kanban' ? (
        <div className="overflow-x-auto pb-2">
          <div className="grid min-w-[1180px] gap-4 xl:min-w-0 xl:grid-cols-6">
            {stageSummary.map((column) => renderStageColumn(column.stage))}
          </div>
        </div>
      ) : (
        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
                  <CardTitle className="text-lg">Table view</CardTitle>
              <CardDescription>Sortable list for users who prefer scanning {dealTerm.plural.toLowerCase()} line by line.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  {[
                    { key: 'contact', label: `${dealTerm.singular} / Contact` },
                    { key: 'stage', label: 'Stage' },
                    { key: 'value', label: 'Value' },
                    { key: 'probability', label: 'Probability' },
                    { key: 'closeDate', label: 'Close Date' },
                    { key: 'daysInStage', label: 'Days in Stage' },
                    { key: 'updatedAt', label: 'Updated' }
                  ].map((column) => (
                    <th key={column.key} className="px-3 py-2">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-medium hover:text-foreground"
                        onClick={() => {
                          setSortField(column.key as SortField)
                          setSortDirection((current) => (sortField === column.key ? (current === 'asc' ? 'desc' : 'asc') : 'asc'))
                        }}
                      >
                        {column.label}
                        {sortField === column.key ? <ArrowDownUp className="h-3.5 w-3.5" /> : null}
                      </button>
                    </th>
                  ))}
                  {showTeamFeatures ? <th className="px-3 py-2">Assigned</th> : null}
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.length ? (
                  tableRows.map((summary) => {
                    const { deal, contact, daysInStage } = summary
                    const overdue = deal.stage !== 'CLOSED_WON' && deal.stage !== 'CLOSED_LOST' && dueDateStatus(deal.expectedCloseDate) === 'overdue'
                    const assigned = deal.assignedTo || 'Unassigned'
                    const initials = getContactInitials(assigned)
                    const assignedAvatar = getContactAvatarClass(assigned)
                    return (
                      <tr key={deal.id} className="rounded-2xl bg-card shadow-sm">
                        <td className="rounded-l-2xl px-3 py-4">
                          <div className="space-y-1">
                            <p className="font-medium">{deal.title}</p>
                            <p className="text-xs text-muted-foreground">{contact ? getContactDisplayName(contact) : deal.contactId}</p>
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <Badge variant={stageVariant(deal.stage)}>{dealStageLabel[deal.stage]}</Badge>
                        </td>
                        <td className="px-3 py-4 font-semibold">{crmMoney.format(deal.value)}</td>
                        <td className="px-3 py-4">
                          <Badge variant={stageVariant(deal.stage)}>{deal.probability}%</Badge>
                        </td>
                        <td className={cn('px-3 py-4 text-sm', overdue ? 'text-rose-600' : 'text-foreground')}>{formatDate(deal.expectedCloseDate)}</td>
                        <td className={cn('px-3 py-4 text-sm', stageAgeClass(daysInStage))}>{daysInStage} days</td>
                        <td className="px-3 py-4 text-sm text-muted-foreground">{crmDateTime.format(new Date(deal.updatedAt))}</td>
                        {showTeamFeatures ? (
                          <td className="px-3 py-4">
                            <div className="flex items-center gap-2">
                              <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold', assignedAvatar)}>{initials}</div>
                              <span className="text-sm">{assigned}</span>
                            </div>
                          </td>
                        ) : null}
                        <td className="rounded-r-2xl px-3 py-4 text-right">
                          <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" variant="ghost" onClick={() => { setActivityDealId(deal.id); setActivityForm(initialActivityForm()); setActivityModalOpen(true) }}>
                              <Activity className="h-4 w-4" />
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => openEditDeal(deal.id)}>
                              <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button asChild type="button" size="sm" variant="ghost">
                              <Link to={`/admin/crm/contacts/${deal.contactId}`}>
                                <ChevronRight className="h-4 w-4" />
                              </Link>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={showTeamFeatures ? 9 : 8}>
                      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No deals match the current filters.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dealModalOpen} onOpenChange={setDealModalOpen}>
        <DialogOverlay className="bg-slate-950/75 backdrop-blur-md" />
        <DialogContent className="w-[min(94vw,58rem)] max-h-[90vh] overflow-y-auto border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5">
          <DialogHeader>
            <DialogTitle>{editingDealId ? `Edit ${dealTerm.singular}` : `New ${dealTerm.singular}`}</DialogTitle>
            <DialogDescription>
              Record the customer, value, stage, and expected close date so follow-ups stay clear and the owner can see which {dealTerm.plural.toLowerCase()} need attention next.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Title</label>
              <Input value={dealForm.title} onChange={(event) => setDealForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Quote for bulk uniforms" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Contact</label>
              <Input value={dealSearch} onChange={(event) => setDealSearch(event.target.value)} placeholder="Search contact by name, company, or phone" />
              <Select value={dealForm.contactId} onChange={(event) => selectDealContact(event.target.value)} className="mt-2">
                <option value="">Select contact</option>
                {filteredContactOptions.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {getContactDisplayName(contact)}{contact.company ? ` · ${contact.company}` : ''}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Value</label>
              <Input value={dealForm.value} onChange={(event) => setDealForm((prev) => ({ ...prev, value: event.target.value }))} placeholder="50000" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Probability</label>
              <Input value={dealForm.probability} onChange={(event) => setDealForm((prev) => ({ ...prev, probability: event.target.value }))} placeholder="35" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Stage</label>
              <Select
                value={dealForm.stage}
                onChange={(event) => setDealForm((prev) => ({ ...prev, stage: event.target.value as Deal['stage'] }))}
                disabled={Boolean(editingDealId)}
              >
                {settings.dealStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {dealStageLabel[stage]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Expected close date</label>
              <Input type="date" value={dealForm.expectedCloseDate} onChange={(event) => setDealForm((prev) => ({ ...prev, expectedCloseDate: event.target.value }))} />
            </div>
            {showTeamFeatures ? (
              <div>
                <label className="mb-1 block text-sm font-medium">Assigned to</label>
                <Select value={dealForm.assignedTo} onChange={(event) => setDealForm((prev) => ({ ...prev, assignedTo: event.target.value }))}>
                  <option value="">Use default assignee</option>
                  {(settings.teamMembers.length ? settings.teamMembers : [settings.defaultAssignee]).map((member) => (
                    <option key={member} value={member}>
                      {member}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea
                value={dealForm.notes}
                onChange={(event) => setDealForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={4}
                className="min-h-28 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDealModalOpen(false)}>
              Cancel
            </Button>
              <Button type="button" onClick={handleSaveDeal} disabled={!dealForm.contactId}>
                {editingDealId ? 'Save changes' : `Create ${dealTerm.singular.toLowerCase()}`}
              </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activityModalOpen} onOpenChange={setActivityModalOpen}>
        <DialogOverlay />
        <DialogContent className="w-[min(94vw,42rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
            <DialogDescription>{activityDeal ? `For ${activityDeal.title}` : `Log a call, meeting, or follow-up from the ${dealTerm.singular.toLowerCase()} board.`}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <Select value={activityForm.type} onChange={(event) => setActivityForm((prev) => ({ ...prev, type: event.target.value as ActivityFormState['type'] }))}>
                <option value="CALL">Call</option>
                <option value="EMAIL">Email</option>
                <option value="MEETING">Meeting</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="DEMO">Demo</option>
                <option value="SITE_VISIT">Site visit</option>
                <option value="FOLLOW_UP">Follow up</option>
                <option value="NOTE">Note</option>
                <option value="TASK">Task</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Scheduled at</label>
              <Input type="datetime-local" value={activityForm.scheduledAt} onChange={(event) => setActivityForm((prev) => ({ ...prev, scheduledAt: event.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Subject</label>
              <Input value={activityForm.subject} onChange={(event) => setActivityForm((prev) => ({ ...prev, subject: event.target.value }))} placeholder="Follow up on quote" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea
                value={activityForm.description}
                onChange={(event) => setActivityForm((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                className="min-h-20 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Outcome</label>
              <Input value={activityForm.outcome} onChange={(event) => setActivityForm((prev) => ({ ...prev, outcome: event.target.value }))} placeholder="Reached decision maker" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActivityModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleLogActivity} disabled={!activityDeal}>
              Save activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(winningDeal)} onOpenChange={(open) => !open && setWinDealId(null)}>
        <DialogOverlay />
        <DialogContent className="w-[min(94vw,40rem)]">
          {winningDeal ? (
            <>
              <DialogHeader>
                <DialogTitle>{dealTerm.singular} won</DialogTitle>
                <DialogDescription>Celebrate the close and move directly into invoicing.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3 rounded-2xl border bg-emerald-50 p-4">
                <p className="text-sm font-medium text-emerald-800">{winningDeal.title}</p>
                <p className="text-2xl font-bold text-emerald-900">{crmMoney.format(winningDeal.value)}</p>
                <p className="text-sm text-emerald-700">{contactById.get(winningDeal.contactId) ? getContactDisplayName(contactById.get(winningDeal.contactId)!) : winningDeal.contactId}</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setWinDealId(null)}>
                  Close
                </Button>
                <Button type="button" variant="outline" onClick={() => createInvoiceFromDeal('PROFORMA')}>
                  Create proforma
                </Button>
                <Button type="button" onClick={() => createInvoiceFromDeal('TAX_INVOICE')}>
                  <CircleDollarSign className="mr-2 h-4 w-4" />
                  Create invoice
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(losingDeal)} onOpenChange={(open) => !open && setLossDealId(null)}>
        <DialogOverlay />
        <DialogContent className="w-[min(94vw,40rem)]">
          <DialogHeader>
            <DialogTitle>{dealTerm.singular} lost</DialogTitle>
            <DialogDescription>Pick a reason so the team can learn and re-engage later if needed.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Loss reason</label>
              <Select value={lossForm.reason} onChange={(event) => setLossForm((prev) => ({ ...prev, reason: event.target.value }))}>
                <option value="">Select reason</option>
                {LOSS_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea
                value={lossForm.notes}
                onChange={(event) => setLossForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={4}
                className="min-h-24 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Optional details about why the deal was lost"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLossDealId(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmLoss} disabled={!lossForm.reason.trim()}>
              Close deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
