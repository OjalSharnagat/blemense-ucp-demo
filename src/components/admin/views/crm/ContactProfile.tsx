import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeDollarSign,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Edit3,
  FileText,
  Hash,
  Mail,
  MapPin,
  MessageSquareText,
  MoreVertical,
  Phone,
  PhoneCall,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  StickyNote,
  Star,
  Target,
  UserRoundPen,
  Users,
  X
} from 'lucide-react'
import { useCRMStore } from '@/lib/crmStore'
import { useBillingStore } from '@/lib/billingStore'
import { usePosStore } from '@/lib/posStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  crmDate,
  crmDateTime,
  crmMoney,
  getContactAvatarClass,
  getContactDisplayName,
  getContactInitials,
  getContactReference,
  panelClassName,
  ratingVariant,
  ScoreBadge,
  stageVariant,
  statusVariant,
  typeVariant
} from './shared'
import type { Activity, Contact, Deal } from '@/data/crm'
import type { Invoice } from '@/data/billing'
import type { POSOrder } from '@/data/pos'

type TabId = 'timeline' | 'deals' | 'activities' | 'billing' | 'pos' | 'notes' | 'custom'
type ActivityFilter = 'ALL' | Activity['type']
type TimelineKind = 'ACTIVITY' | 'DEAL_STAGE' | 'ORDER' | 'INVOICE' | 'PAYMENT' | 'POS_ORDER' | 'NOTE' | 'CONTACT_UPDATED'

type EditDraft = {
  firstName: string
  lastName: string
  displayName: string
  company: string
  designation: string
  email: string
  phone: string
  altPhone: string
  whatsapp: string
  address: string
  city: string
  state: string
  pincode: string
  gstin: string
  pan: string
  source: Contact['source'] | ''
  assignedTo: string
  status: Contact['status']
  rating: Contact['rating'] | ''
  type: Contact['type']
  entityType: Contact['entityType']
  tags: string[]
}

type ActivityDraft = {
  type: Activity['type']
  subject: string
  description: string
  outcome: string
  scheduledAt: string
  status: Activity['status']
  duration: string
}

type DealDraft = {
  title: string
  value: string
  stage: Deal['stage']
  probability: string
  expectedCloseDate: string
  assignedTo: string
  notes: string
  productIds: string
}

function normalizeText(value: string | undefined | null): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeDigits(value: string | undefined | null): string {
  return String(value ?? '').replace(/\D/g, '')
}

function formatDisplayName(contact: Contact): string {
  return getContactDisplayName(contact)
}

function buildEditDraft(contact: Contact): EditDraft {
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    displayName: contact.displayName,
    company: contact.company || '',
    designation: contact.designation || '',
    email: contact.email || '',
    phone: contact.phone || '',
    altPhone: contact.altPhone || '',
    whatsapp: contact.whatsapp || '',
    address: contact.address || '',
    city: contact.city || '',
    state: contact.state || '',
    pincode: contact.pincode || '',
    gstin: contact.gstin || '',
    pan: contact.pan || '',
    source: contact.source || '',
    assignedTo: contact.assignedTo || '',
    status: contact.status,
    rating: contact.rating || '',
    type: contact.type,
    entityType: contact.entityType,
    tags: [...contact.tags]
  }
}

function buildActivityDraft(): ActivityDraft {
  return {
    type: 'FOLLOW_UP',
    subject: '',
    description: '',
    outcome: '',
    scheduledAt: '',
    status: 'SCHEDULED',
    duration: ''
  }
}

function buildDealDraft(defaultAssignee: string): DealDraft {
  return {
    title: '',
    value: '',
    stage: 'LEAD',
    probability: '15',
    expectedCloseDate: '',
    assignedTo: defaultAssignee,
    notes: '',
    productIds: ''
  }
}

function matchesInvoice(contact: Contact, invoice: Invoice): boolean {
  if (contact.linkedCustomerId && invoice.customerId === contact.linkedCustomerId) return true

  const contactNames = [contact.displayName, contact.company, `${contact.firstName} ${contact.lastName}`]
    .map(normalizeText)
    .filter(Boolean)
  const buyerName = normalizeText(invoice.buyer.name)
  const buyerEmail = normalizeText(invoice.buyer.email)
  const contactEmail = normalizeText(contact.email)
  const buyerPhone = normalizeDigits(invoice.buyer.phone)
  const contactPhones = [contact.phone, contact.whatsapp, contact.altPhone].map(normalizeDigits).filter(Boolean)

  return (
    contactNames.includes(buyerName) ||
    (contactEmail && contactEmail === buyerEmail) ||
    (buyerPhone && contactPhones.includes(buyerPhone))
  )
}

function matchesPosOrder(contact: Contact, order: POSOrder): boolean {
  const contactNames = [contact.displayName, contact.company, `${contact.firstName} ${contact.lastName}`]
    .map(normalizeText)
    .filter(Boolean)
  const orderName = normalizeText(order.customerName)
  const orderPhone = normalizeDigits(order.customerPhone)
  const contactPhones = [contact.phone, contact.whatsapp, contact.altPhone].map(normalizeDigits).filter(Boolean)

  return contactNames.includes(orderName) || (orderPhone && contactPhones.includes(orderPhone))
}

function timelineIcon(kind: TimelineKind) {
  switch (kind) {
    case 'ACTIVITY':
      return PhoneCall
    case 'DEAL_STAGE':
      return Target
    case 'ORDER':
      return ShoppingBag
    case 'INVOICE':
      return ReceiptText
    case 'PAYMENT':
      return CircleDollarSign
    case 'POS_ORDER':
      return ClipboardList
    case 'NOTE':
      return StickyNote
    case 'CONTACT_UPDATED':
      return UserRoundPen
    default:
      return FileText
  }
}

function timelineBadgeVariant(kind: TimelineKind) {
  switch (kind) {
    case 'PAYMENT':
      return 'success'
    case 'DEAL_STAGE':
      return 'warning'
    case 'CONTACT_UPDATED':
      return 'secondary'
    case 'NOTE':
      return 'secondary'
    case 'ACTIVITY':
      return 'default'
    case 'INVOICE':
      return 'default'
    case 'ORDER':
    case 'POS_ORDER':
      return 'secondary'
    default:
      return 'secondary'
  }
}

function isFutureScheduled(activity: Activity): boolean {
  if (activity.status !== 'SCHEDULED') return false
  if (!activity.scheduledAt) return true
  return new Date(activity.scheduledAt).getTime() >= Date.now()
}

export default function ContactProfile() {
  const navigate = useNavigate()
  const { id } = useParams()
  const {
    contacts,
    deals,
    activities,
    contactNotes,
    settings,
    updateContact,
    deleteContact,
    mergeContacts,
    createDeal,
    moveDealStage,
    logActivity,
    addContactNote,
    computeContactScore,
    getContactTimeline
  } = useCRMStore()
  const { invoices, payments } = useBillingStore()
  const { orders: posOrders } = usePosStore()

  const contact = contacts.find((item) => item.id === id)
  const [activeTab, setActiveTab] = useState<TabId>('timeline')
  const [editOpen, setEditOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [dealDetailId, setDealDetailId] = useState<string | null>(null)
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [tagDraft, setTagDraft] = useState('')
  const [assignedDraft, setAssignedDraft] = useState(contact?.assignedTo || '')
  const [mergeSearch, setMergeSearch] = useState('')
  const [editDraft, setEditDraft] = useState<EditDraft | null>(contact ? buildEditDraft(contact) : null)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('ALL')
  const [activityDraft, setActivityDraft] = useState<ActivityDraft>(buildActivityDraft())
  const [dealDraft, setDealDraft] = useState<DealDraft>(buildDealDraft(settings.defaultAssignee))
  const [customDraft, setCustomDraft] = useState<Record<string, string>>({})

  const currentDeal = useMemo(
    () => (dealDetailId ? deals.find((deal) => deal.id === dealDetailId) ?? null : null),
    [dealDetailId, deals]
  )

  const contactNotesList = useMemo(
    () =>
      contact
        ? contactNotes
            .filter((note) => note.contactId === contact.id)
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        : [],
    [contact, contactNotes]
  )

  const contactDeals = useMemo(
    () => (contact ? deals.filter((deal) => deal.contactId === contact.id) : []),
    [contact, deals]
  )

  const contactActivities = useMemo(
    () => (contact ? activities.filter((activity) => activity.contactId === contact.id) : []),
    [activities, contact]
  )

  const timeline = useMemo(() => (contact ? getContactTimeline(contact.id) : []), [contact, getContactTimeline])

  const linkedInvoices = useMemo(
    () => (contact ? invoices.filter((invoice) => matchesInvoice(contact, invoice)) : []),
    [contact, invoices]
  )

  const linkedPayments = useMemo(
    () => (contact ? payments.filter((payment) => linkedInvoices.some((invoice) => invoice.id === payment.invoiceId) || payment.customerId === contact.linkedCustomerId) : []),
    [contact, linkedInvoices, payments]
  )

  const linkedPosOrders = useMemo(
    () => (contact ? posOrders.filter((order) => matchesPosOrder(contact, order)) : []),
    [contact, posOrders]
  )

  const upcomingActivities = useMemo(
    () =>
      contactActivities
        .filter((activity) => isFutureScheduled(activity))
        .sort((a, b) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime()),
    [contactActivities]
  )

  const pastActivities = useMemo(
    () =>
      contactActivities
        .filter((activity) => !isFutureScheduled(activity))
        .sort((a, b) => new Date(b.completedAt || b.scheduledAt || 0).getTime() - new Date(a.completedAt || a.scheduledAt || 0).getTime()),
    [contactActivities]
  )

  const filteredActivities = useMemo(() => {
    const source = [...upcomingActivities, ...pastActivities]
    if (activityFilter === 'ALL') return source
    return source.filter((activity) => activity.type === activityFilter)
  }, [activityFilter, upcomingActivities, pastActivities])

  const topTimelineEntries = timeline.slice(0, 10)
  const computeScore = contact ? computeContactScore(contact.id) : 0
  const openDeals = contactDeals.filter((deal) => !deal.stage.startsWith('CLOSED'))
  const wonDeals = contactDeals.filter((deal) => deal.stage === 'CLOSED_WON')
  const lostDeals = contactDeals.filter((deal) => deal.stage === 'CLOSED_LOST')
  const lifetimeValue = linkedInvoices.reduce((sum, invoice) => sum + invoice.taxBreakdown.grandTotal, 0)
  const outstandingBalance = linkedInvoices.reduce((sum, invoice) => sum + invoice.balanceDue, 0)
  const posTotal = linkedPosOrders.reduce((sum, order) => sum + order.total, 0)
  const posAverage = linkedPosOrders.length ? posTotal / linkedPosOrders.length : 0
  const lastPosVisit = linkedPosOrders
    .map((order) => order.completedAt)
    .filter(Boolean)
    .sort()
    .slice(-1)[0]

  const editableCustomFieldKeys = useMemo(() => {
    if (!contact) return []
    return [...new Set([...settings.customContactFields, ...Object.keys(contact.customFields)])].sort((a, b) => a.localeCompare(b))
  }, [contact, settings.customContactFields])

  const mergeCandidates = useMemo(
    () =>
      contacts
        .filter((candidate) => candidate.id !== contact?.id)
        .filter((candidate) => {
          if (!mergeSearch.trim()) return true
          const query = normalizeText(mergeSearch)
          return [
            getContactDisplayName(candidate),
            candidate.company,
            candidate.phone,
            candidate.email,
            candidate.assignedTo
          ]
            .filter(Boolean)
            .some((value) => normalizeText(String(value)).includes(query))
        })
        .slice(0, 20),
    [contact?.id, contacts, mergeSearch]
  )

  if (!contact) {
    return (
      <div className="dash-view">
        <Card className={panelClassName()}>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
            <p className="text-lg font-medium">Contact not found</p>
            <Button asChild variant="outline">
              <Link to="/admin/crm/contacts">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to contacts
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const contactDisplayName = formatDisplayName(contact)
  const contactInitials = getContactInitials(contactDisplayName)

  const handleOpenEdit = () => {
    setEditDraft(buildEditDraft(contact))
    setEditOpen(true)
  }

  const handleSaveEdit = () => {
    if (!editDraft) return

    const nextDisplayName =
      editDraft.displayName.trim() ||
      [editDraft.firstName, editDraft.lastName].filter(Boolean).join(' ').trim() ||
      editDraft.company.trim() ||
      contact.displayName

    updateContact({
      ...contact,
      firstName: editDraft.firstName.trim() || contact.firstName,
      lastName: editDraft.lastName.trim() || contact.lastName,
      displayName: nextDisplayName,
      company: editDraft.company.trim() || undefined,
      designation: editDraft.designation.trim() || undefined,
      email: editDraft.email.trim() || undefined,
      phone: editDraft.phone.trim() || undefined,
      altPhone: editDraft.altPhone.trim() || undefined,
      whatsapp: editDraft.whatsapp.trim() || undefined,
      address: editDraft.address.trim() || undefined,
      city: editDraft.city.trim() || undefined,
      state: editDraft.state.trim() || undefined,
      pincode: editDraft.pincode.trim() || undefined,
      gstin: editDraft.gstin.trim() || undefined,
      pan: editDraft.pan.trim() || undefined,
      source: editDraft.source || undefined,
      assignedTo: editDraft.assignedTo.trim() || undefined,
      status: editDraft.status,
      rating: editDraft.type === 'LEAD' ? (editDraft.rating || undefined) : undefined,
      type: editDraft.type,
      entityType: editDraft.entityType,
      tags: editDraft.tags,
      notes: contact.notes,
      customFields: contact.customFields
    })
    setEditOpen(false)
    setAssignedDraft(editDraft.assignedTo.trim() || '')
  }

  const handleAddTag = () => {
    const nextTag = tagDraft.trim()
    if (!nextTag || contact.tags.includes(nextTag)) return
    updateContact({ ...contact, tags: [...contact.tags, nextTag] })
    setTagDraft('')
  }

  const handleRemoveTag = (tag: string) => {
    updateContact({ ...contact, tags: contact.tags.filter((entry) => entry !== tag) })
  }

  const handleAssignedChange = (value: string) => {
    setAssignedDraft(value)
  }

  const handleAssignedCommit = () => {
    updateContact({ ...contact, assignedTo: assignedDraft.trim() || undefined })
  }

  const handleConvertLead = () => {
    updateContact({
      ...contact,
      type: 'CUSTOMER',
      rating: undefined,
      status: 'ACTIVE'
    })
  }

  const handleBlockContact = () => {
    updateContact({
      ...contact,
      status: 'BLOCKED'
    })
  }

  const handleDeleteContact = () => {
    const ok = window.confirm(`Delete ${contactDisplayName}? This cannot be undone.`)
    if (!ok) return
    deleteContact(contact.id)
    navigate('/admin/crm/contacts')
  }

  const handleMergeContact = (duplicateId: string) => {
    if (duplicateId === contact.id) return
    const merged = mergeContacts(contact.id, duplicateId)
    if (merged) {
      setMergeOpen(false)
      setMergeSearch('')
      setActiveTab('timeline')
    }
  }

  const handleQuickLog = (type: 'CALL' | 'WHATSAPP') => {
    const now = new Date().toISOString()
    logActivity({
      type,
      contactId: contact.id,
      subject: type === 'CALL' ? 'Quick call log' : 'Quick WhatsApp log',
      description: `${type === 'CALL' ? 'Phone' : 'WhatsApp'} follow-up logged from the contact profile.`,
      outcome: type === 'CALL' ? 'Call logged' : 'WhatsApp logged',
      completedAt: now,
      status: 'COMPLETED',
      createdBy: settings.defaultAssignee,
      attachments: []
    })
  }

  const handleCreateActivity = () => {
    const scheduledAt = activityDraft.scheduledAt.trim()
    const now = new Date().toISOString()
    const completedAt = activityDraft.status === 'COMPLETED' ? now : undefined

    logActivity({
      type: activityDraft.type,
      contactId: contact.id,
      subject: activityDraft.subject.trim() || `${activityDraft.type} follow-up`,
      description: activityDraft.description.trim() || undefined,
      outcome: activityDraft.outcome.trim() || undefined,
      scheduledAt: scheduledAt || undefined,
      completedAt,
      duration: activityDraft.duration.trim() ? Number(activityDraft.duration) : undefined,
      status: activityDraft.status,
      createdBy: settings.defaultAssignee,
      reminder: settings.reminderDefaults.followUp,
      attachments: []
    })

    setActivityDraft(buildActivityDraft())
    setActivityOpen(false)
  }

  const handleCreateDeal = () => {
    const value = Number(dealDraft.value || 0)
    const probability = Number(dealDraft.probability || 0)
    const expectedCloseDate = dealDraft.expectedCloseDate.trim() || undefined
    createDeal({
      title: dealDraft.title.trim() || `${contactDisplayName} opportunity`,
      contactId: contact.id,
      value: Number.isFinite(value) ? value : 0,
      currency: 'INR',
      stage: dealDraft.stage,
      probability: Math.max(0, Math.min(100, Number.isFinite(probability) ? probability : 0)),
      expectedCloseDate,
      assignedTo: dealDraft.assignedTo.trim() || settings.defaultAssignee,
      productIds: dealDraft.productIds
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      notes: dealDraft.notes.trim() || undefined,
      source: contact.source,
      tags: [...contact.tags],
      activities: []
    })
    setDealDraft(buildDealDraft(settings.defaultAssignee))
    setNewDealOpen(false)
  }

  const handleSaveNotes = () => {
    const body = noteDraft.trim()
    if (!body) return
    addContactNote({
      contactId: contact.id,
      body,
      author: settings.defaultAssignee
    })
    setNoteDraft('')
  }

  const handleSaveCustomFields = () => {
    const nextCustomFields = editableCustomFieldKeys.reduce<Record<string, string | number | boolean | null | undefined>>((acc, key) => {
      const value = (customDraft[key] ?? String(contact.customFields[key] ?? '')).trim()
      if (!value) return acc
      acc[key] = value
      return acc
    }, {})

    updateContact({
      ...contact,
      customFields: nextCustomFields
    })
  }

  const renderTimeline = () => (
    <div className="space-y-3">
      {topTimelineEntries.length ? (
        topTimelineEntries.map((entry) => {
          const Icon = timelineIcon(entry.kind as TimelineKind)
          return (
            <div key={`${entry.kind}-${entry.id}`} className="rounded-2xl border bg-muted/20 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background shadow-sm">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={timelineBadgeVariant(entry.kind as TimelineKind)}>{entry.kind.replace('_', ' ')}</Badge>
                    <p className="font-medium">{entry.title}</p>
                  </div>
                  {entry.detail ? <p className="mt-1 text-sm text-muted-foreground">{entry.detail}</p> : null}
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span>{crmDateTime.format(new Date(entry.timestamp))}</span>
                    {entry.createdBy ? <span>by {entry.createdBy}</span> : null}
                    {entry.reference ? <span>Ref: {entry.reference}</span> : null}
                  </div>
                </div>
                {'amount' in entry ? <p className="text-sm font-semibold">{crmMoney.format(entry.amount)}</p> : null}
              </div>
            </div>
          )
        })
      ) : (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No timeline activity yet.</div>
      )}
    </div>
  )

  const renderDeals = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">All deals linked to this contact.</p>
          <p className="text-xs text-muted-foreground">
            {openDeals.length} open, {wonDeals.length} won, {lostDeals.length} lost.
          </p>
        </div>
        <Button type="button" onClick={() => setNewDealOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Deal
        </Button>
      </div>

      <div className="grid gap-3">
        {contactDeals.length ? (
          contactDeals.map((deal) => (
            <button
              key={deal.id}
              type="button"
              onClick={() => setDealDetailId(deal.id)}
              className="w-full rounded-2xl border bg-muted/20 p-4 text-left transition hover:border-primary/40 hover:bg-muted/30"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{deal.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {deal.expectedCloseDate ? `Expected close ${crmDate.format(new Date(deal.expectedCloseDate))}` : 'No expected close date'}
                  </p>
                </div>
                <Badge variant={stageVariant(deal.stage)}>{deal.stage.replace('_', ' ')}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium">{crmMoney.format(deal.value)}</span>
                <span className="text-muted-foreground">{deal.probability}% probability</span>
                {deal.assignedTo ? <span className="text-muted-foreground">Assigned to {deal.assignedTo}</span> : null}
              </div>
              {deal.notes ? <p className="mt-2 text-sm text-muted-foreground">{deal.notes}</p> : null}
            </button>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No deals linked to this contact yet.</div>
        )}
      </div>
    </div>
  )

  const renderActivities = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-sm text-muted-foreground">Past activities are listed newest first. Upcoming activities stay at the top.</p>
          <p className="text-xs text-muted-foreground">Quick actions from the contact card also land here.</p>
        </div>
        <Button type="button" onClick={() => setActivityOpen(true)}>
          <CalendarClock className="mr-2 h-4 w-4" />
          Log Activity
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={activityFilter} onChange={(event) => setActivityFilter(event.target.value as ActivityFilter)}>
          <option value="ALL">All types</option>
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

      <div className="space-y-3">
        {filteredActivities.length ? (
          filteredActivities.map((activity) => (
            <div
              key={activity.id}
              className={cn(
                'rounded-2xl border p-4',
                activity.status === 'SCHEDULED' ? 'bg-amber-50/60 border-amber-200' : 'bg-muted/20'
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={activity.status === 'SCHEDULED' ? 'warning' : 'default'}>{activity.type}</Badge>
                    <p className="font-medium">{activity.subject}</p>
                  </div>
                  {activity.description ? <p className="mt-1 text-sm text-muted-foreground">{activity.description}</p> : null}
                  {activity.outcome ? <p className="mt-1 text-sm text-muted-foreground">Outcome: {activity.outcome}</p> : null}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>{activity.scheduledAt ? crmDateTime.format(new Date(activity.scheduledAt)) : activity.completedAt ? crmDateTime.format(new Date(activity.completedAt)) : 'No time set'}</p>
                  {activity.createdBy ? <p>by {activity.createdBy}</p> : null}
                  {activity.duration ? <p>{activity.duration} min</p> : null}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No activities match the current filter.</div>
        )}
      </div>
    </div>
  )

  const renderBilling = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Lifetime value</p>
            <p className="mt-2 text-2xl font-semibold">{crmMoney.format(lifetimeValue)}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Outstanding balance</p>
            <p className="mt-2 text-2xl font-semibold">{crmMoney.format(outstandingBalance)}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Invoices</p>
            <p className="mt-2 text-2xl font-semibold">{linkedInvoices.length}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Payments</p>
            <p className="mt-2 text-2xl font-semibold">{linkedPayments.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Invoice history and payment trail from the billing module.</p>
        </div>
        <Button asChild>
          <Link to="/admin/billing/new">
            <BadgeDollarSign className="mr-2 h-4 w-4" />
            Create Invoice
          </Link>
        </Button>
      </div>

      <div className="space-y-3">
        {linkedInvoices.length ? (
          linkedInvoices.map((invoice) => {
            const invoicePayments = linkedPayments.filter((payment) => payment.invoiceId === invoice.id)
            return (
              <div key={invoice.id} className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={invoice.status === 'PAID' ? 'success' : invoice.status === 'OVERDUE' ? 'destructive' : 'secondary'}>
                        {invoice.status.replace('_', ' ')}
                      </Badge>
                      <p className="font-medium">{invoice.invoiceNumber}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Issued {crmDate.format(new Date(invoice.issueDate))} · Due {crmDate.format(new Date(invoice.dueDate))}
                    </p>
                    <p className="text-sm text-muted-foreground">{invoice.buyer.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{crmMoney.format(invoice.taxBreakdown.grandTotal)}</p>
                    <p className="text-xs text-muted-foreground">Balance {crmMoney.format(invoice.balanceDue)}</p>
                  </div>
                </div>
                {invoicePayments.length ? (
                  <div className="mt-4 space-y-2">
                    {invoicePayments.map((payment) => (
                      <div key={payment.id} className="rounded-xl border bg-background/80 p-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">Payment received</p>
                            <p className="text-muted-foreground">
                              {payment.mode} · {payment.reference || 'No reference'}
                            </p>
                          </div>
                          <p className="font-semibold">{crmMoney.format(payment.amount)}</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{crmDateTime.format(new Date(payment.date))}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })
        ) : (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No billing history linked to this contact yet.</div>
        )}
      </div>
    </div>
  )

  const renderPos = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">POS spend</p>
            <p className="mt-2 text-2xl font-semibold">{crmMoney.format(posTotal)}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Average order value</p>
            <p className="mt-2 text-2xl font-semibold">{crmMoney.format(posAverage)}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Last visit</p>
            <p className="mt-2 text-lg font-semibold">{lastPosVisit ? crmDate.format(new Date(lastPosVisit)) : 'No POS visit yet'}</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {linkedPosOrders.length ? (
          linkedPosOrders
            .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
            .map((order) => (
              <div key={order.id} className="rounded-2xl border bg-muted/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={order.status === 'COMPLETED' ? 'success' : 'secondary'}>{order.status}</Badge>
                      <p className="font-medium">{order.orderNumber}</p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{crmDateTime.format(new Date(order.completedAt))}</p>
                    <p className="text-sm text-muted-foreground">{order.customerName || contactDisplayName}</p>
                  </div>
                  <p className="text-sm font-semibold">{crmMoney.format(order.total)}</p>
                </div>
                {order.notes ? <p className="mt-2 text-sm text-muted-foreground">{order.notes}</p> : null}
              </div>
            ))
        ) : (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No POS history found for this contact.</div>
        )}
      </div>
    </div>
  )

  const renderNotes = () => (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
        <textarea
          value={noteDraft}
          onChange={(event) => setNoteDraft(event.target.value)}
          rows={4}
          placeholder="Capture a call result, preference, objection, or next step..."
          className="min-h-28 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <div className="flex items-start">
          <Button type="button" onClick={handleSaveNotes} className="w-full md:w-auto">
            <StickyNote className="mr-2 h-4 w-4" />
            Add Note
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {contactNotesList.length ? (
          contactNotesList.map((note) => (
            <div key={note.id} className="rounded-2xl border bg-muted/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{note.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">by {note.author}</p>
                </div>
                <p className="text-xs text-muted-foreground">{crmDateTime.format(new Date(note.updatedAt))}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No notes have been added yet.</div>
        )}
      </div>
    </div>
  )

  const renderCustomFields = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Custom CRM settings fields for this business.</p>
          <p className="text-xs text-muted-foreground">Values are saved back to the contact record.</p>
        </div>
        <Button type="button" onClick={handleSaveCustomFields}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          Save Custom Fields
        </Button>
      </div>

      {editableCustomFieldKeys.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {editableCustomFieldKeys.map((field) => (
            <div key={field} className="space-y-2 rounded-2xl border bg-muted/20 p-4">
              <label className="text-sm font-medium capitalize">{field.replace(/([A-Z])/g, ' $1')}</label>
              <Input
                value={customDraft[field] ?? String(contact.customFields[field] ?? '')}
                onChange={(event) => setCustomDraft((prev) => ({ ...prev, [field]: event.target.value }))}
                placeholder={`Enter ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No custom fields are configured in CRM settings.</div>
      )}
    </div>
  )

  const tabs: Array<{ id: TabId; label: string; icon: typeof FileText }> = [
    { id: 'timeline', label: 'Timeline', icon: FileText },
    { id: 'deals', label: 'Deals', icon: Target },
    { id: 'activities', label: 'Activities', icon: CalendarClock },
    { id: 'billing', label: 'Orders & Billing', icon: BadgeDollarSign },
    { id: 'pos', label: 'POS History', icon: ShoppingBag },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    { id: 'custom', label: 'Custom Fields', icon: Users }
  ]

  const sortedTags = [...contact.tags].sort((a, b) => a.localeCompare(b))

  return (
    <div className="dash-view space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button asChild variant="ghost" className="gap-2 px-0 hover:bg-transparent hover:text-primary">
            <Link to="/admin/crm/contacts">
              <ArrowLeft className="h-4 w-4" />
              Back to contacts
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{contactDisplayName}</h1>
            <Badge variant={typeVariant(contact.type)}>{contact.type}</Badge>
            <Badge variant={statusVariant(contact.status)}>{contact.status}</Badge>
            {contact.rating ? <Badge variant={ratingVariant(contact.rating)}>{contact.rating}</Badge> : null}
            <ScoreBadge score={computeScore} />
          </div>
          <p className="text-sm text-muted-foreground">{getContactReference(contact) || 'No company or designation added yet.'}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={handleOpenEdit}>
            <Edit3 className="mr-2 h-4 w-4" />
            Edit Contact
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/crm/pipeline">
              <Target className="mr-2 h-4 w-4" />
              Pipeline
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="rounded-full border">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Open contact actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setMergeOpen(true)}>Merge with another contact</DropdownMenuItem>
              <DropdownMenuItem onClick={handleConvertLead} disabled={contact.type !== 'LEAD'}>
                Convert Lead to Customer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBlockContact}>Block contact</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDeleteContact} className="text-destructive focus:text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <Card className={panelClassName('sticky top-4')}>
            <CardContent className="space-y-5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className={cn('flex h-20 w-20 items-center justify-center rounded-3xl text-2xl font-semibold', getContactAvatarClass(contactDisplayName))}>
                  {contactInitials}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => handleQuickLog('CALL')}>
                    <PhoneCall className="mr-2 h-4 w-4" />
                    Log Call
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => handleQuickLog('WHATSAPP')}>
                    <MessageSquareText className="mr-2 h-4 w-4" />
                    Log WhatsApp
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-2xl font-semibold tracking-tight">{contactDisplayName}</p>
                <p className="text-sm text-muted-foreground">{contact.company || contact.designation || 'No company set'}</p>
                {contact.designation ? <p className="text-sm text-muted-foreground">{contact.designation}</p> : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant={typeVariant(contact.type)}>{contact.type}</Badge>
                <Badge variant={statusVariant(contact.status)}>{contact.status}</Badge>
                {contact.rating ? <Badge variant={ratingVariant(contact.rating)}>{contact.rating}</Badge> : null}
                <Badge variant="secondary">Score {computeScore}</Badge>
              </div>

              <div className="space-y-3 text-sm">
                {contact.phone ? (
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{contact.phone}</span>
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={() => handleQuickLog('CALL')}>
                        Log Call
                      </Button>
                    </div>
                  </div>
                ) : null}

                {contact.whatsapp ? (
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <MessageSquareText className="h-4 w-4 text-muted-foreground" />
                        <span>{contact.whatsapp}</span>
                      </div>
                      <Button type="button" size="sm" variant="ghost" onClick={() => handleQuickLog('WHATSAPP')}>
                        Log WhatsApp
                      </Button>
                    </div>
                  </div>
                ) : null}

                {contact.email ? (
                  <div className="flex items-center gap-2 rounded-2xl border bg-muted/20 p-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{contact.email}</span>
                  </div>
                ) : null}

                {contact.gstin ? (
                  <div className="flex items-center gap-2 rounded-2xl border bg-muted/20 p-3">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span>GSTIN {contact.gstin}</span>
                  </div>
                ) : null}

                {contact.pan ? (
                  <div className="flex items-center gap-2 rounded-2xl border bg-muted/20 p-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>PAN {contact.pan}</span>
                  </div>
                ) : null}

                {(contact.city || contact.state || contact.pincode || contact.address) ? (
                  <div className="flex items-start gap-2 rounded-2xl border bg-muted/20 p-3">
                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="space-y-1">
                      <p>{[contact.address, contact.city, contact.state].filter(Boolean).join(', ')}</p>
                      {contact.pincode ? <p className="text-xs text-muted-foreground">{contact.pincode}</p> : null}
                    </div>
                  </div>
                ) : null}

                <div className="flex items-center gap-2 rounded-2xl border bg-muted/20 p-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>Assigned to {assignedDraft || contact.assignedTo || 'Unassigned'}</span>
                </div>

                <div className="rounded-2xl border bg-muted/20 p-3">
                  <label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Assigned To</label>
                  <Input
                    value={assignedDraft}
                    onChange={(event) => handleAssignedChange(event.target.value)}
                    onBlur={handleAssignedCommit}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        handleAssignedCommit()
                      }
                    }}
                    placeholder="Sales owner"
                  />
                </div>

                <div className="rounded-2xl border bg-muted/20 p-3">
                  <label className="mb-2 block text-xs uppercase tracking-wide text-muted-foreground">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {sortedTags.length ? (
                      sortedTags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs capitalize"
                        >
                          {tag}
                          <button type="button" onClick={() => handleRemoveTag(tag)} className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${tag}`}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">No tags yet.</span>
                    )}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} placeholder="Add tag" onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), handleAddTag())} />
                    <Button type="button" variant="outline" onClick={handleAddTag}>
                      Add
                    </Button>
                  </div>
                </div>

                {contact.type === 'LEAD' ? (
                  <div className="rounded-2xl border bg-muted/20 p-3">
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Lead rating</p>
                    <div className="flex items-center gap-2">
                      {(['HOT', 'WARM', 'COLD'] as const).map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() =>
                            updateContact({
                              ...contact,
                              rating
                            })
                          }
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition',
                            contact.rating === rating ? 'border-primary bg-primary/10 text-primary' : 'bg-background text-foreground'
                          )}
                        >
                          <Star className="h-3.5 w-3.5" />
                          {rating}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-muted/20 p-3 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Source</p>
                    <p className="mt-1">{contact.source || 'OTHER'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                    <p className="mt-1">{crmDate.format(new Date(contact.createdAt))}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Last contacted</p>
                    <p className="mt-1">{contact.lastContactedAt ? crmDate.format(new Date(contact.lastContactedAt)) : 'Not contacted yet'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
                    <p className="mt-1">{crmDate.format(new Date(contact.updatedAt))}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <div className="space-y-6">
          <Card className={panelClassName()}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Contact 360</CardTitle>
                  <CardDescription>Everything sales, finance, and ownership need in one place.</CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Relationship score</p>
                  <ScoreBadge score={computeScore} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 rounded-2xl border bg-muted/20 p-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
                        activeTab === tab.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  )
                })}
              </div>

              <div>
                {activeTab === 'timeline' ? renderTimeline() : null}
                {activeTab === 'deals' ? renderDeals() : null}
                {activeTab === 'activities' ? renderActivities() : null}
                {activeTab === 'billing' ? renderBilling() : null}
                {activeTab === 'pos' ? renderPos() : null}
                {activeTab === 'notes' ? renderNotes() : null}
                {activeTab === 'custom' ? renderCustomFields() : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogOverlay />
        <DialogContent className="!left-auto !right-0 !top-0 !h-full !w-[min(94vw,42rem)] !translate-x-0 !translate-y-0 overflow-y-auto rounded-none border-l border-border bg-background p-0 shadow-2xl">
          <div className="flex h-full flex-col">
            <DialogHeader className="border-b bg-muted/30 px-6 py-5">
              <DialogTitle>Edit Contact</DialogTitle>
              <DialogDescription>Update the essentials and save the profile without leaving the page.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">First name</label>
                <Input value={editDraft?.firstName ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, firstName: event.target.value } : prev))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Last name</label>
                <Input value={editDraft?.lastName ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, lastName: event.target.value } : prev))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Display name</label>
                <Input value={editDraft?.displayName ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Company</label>
                <Input value={editDraft?.company ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, company: event.target.value } : prev))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Designation</label>
                <Input value={editDraft?.designation ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, designation: event.target.value } : prev))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Type</label>
                <Select value={editDraft?.type ?? 'CUSTOMER'} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, type: event.target.value as Contact['type'] } : prev))}>
                  <option value="CUSTOMER">Customer</option>
                  <option value="LEAD">Lead</option>
                  <option value="VENDOR">Vendor</option>
                  <option value="PARTNER">Partner</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Entity type</label>
                <Select
                  value={editDraft?.entityType ?? 'INDIVIDUAL'}
                  onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, entityType: event.target.value as Contact['entityType'] } : prev))}
                >
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="BUSINESS">Business</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <Select value={editDraft?.status ?? 'ACTIVE'} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, status: event.target.value as Contact['status'] } : prev))}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="BLOCKED">Blocked</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Rating</label>
                <Select
                  value={editDraft?.rating ?? ''}
                  onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, rating: (event.target.value as Contact['rating']) || '' } : prev))}
                  disabled={editDraft?.type !== 'LEAD'}
                >
                  <option value="">Not set</option>
                  <option value="HOT">Hot</option>
                  <option value="WARM">Warm</option>
                  <option value="COLD">Cold</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Phone</label>
                <Input value={editDraft?.phone ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, phone: event.target.value } : prev))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">WhatsApp</label>
                <Input value={editDraft?.whatsapp ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, whatsapp: event.target.value } : prev))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Email</label>
                <Input value={editDraft?.email ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, email: event.target.value } : prev))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Assigned to</label>
                <Input value={editDraft?.assignedTo ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, assignedTo: event.target.value } : prev))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Source</label>
                <Select value={editDraft?.source ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, source: event.target.value as Contact['source'] | '' } : prev))}>
                  <option value="">Not set</option>
                  <option value="WALK_IN">Walk-in</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="WEBSITE">Website</option>
                  <option value="SOCIAL_MEDIA">Social media</option>
                  <option value="COLD_CALL">Cold call</option>
                  <option value="EXHIBITION">Exhibition</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Address</label>
                <Input value={editDraft?.address ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, address: event.target.value } : prev))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">City</label>
                <Input value={editDraft?.city ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, city: event.target.value } : prev))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">State</label>
                <Input value={editDraft?.state ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, state: event.target.value } : prev))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Pincode</label>
                <Input value={editDraft?.pincode ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, pincode: event.target.value } : prev))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">GSTIN</label>
                <Input value={editDraft?.gstin ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, gstin: event.target.value } : prev))} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">PAN</label>
                <Input value={editDraft?.pan ?? ''} onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, pan: event.target.value } : prev))} />
              </div>
            </div>
            <DialogFooter className="border-t bg-muted/30 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleSaveEdit}>
                Save changes
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogOverlay />
        <DialogContent className="w-[min(94vw,40rem)]">
          <DialogHeader>
            <DialogTitle>Merge contacts</DialogTitle>
            <DialogDescription>Select the duplicate record to merge into this contact.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={mergeSearch} onChange={(event) => setMergeSearch(event.target.value)} className="pl-9" placeholder="Search duplicate contacts" />
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {mergeCandidates.length ? (
                mergeCandidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    onClick={() => handleMergeContact(candidate.id)}
                    className="flex w-full items-center justify-between rounded-xl border bg-muted/20 px-4 py-3 text-left hover:border-primary/40 hover:bg-muted/30"
                  >
                    <div>
                      <p className="font-medium">{getContactDisplayName(candidate)}</p>
                      <p className="text-sm text-muted-foreground">{candidate.company || candidate.phone || candidate.email || 'No extra details'}</p>
                    </div>
                    <Badge variant={typeVariant(candidate.type)}>{candidate.type}</Badge>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No other contacts match that search.</div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMergeOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newDealOpen} onOpenChange={setNewDealOpen}>
        <DialogOverlay />
        <DialogContent className="w-[min(94vw,44rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New deal</DialogTitle>
            <DialogDescription>Start a deal directly from the contact profile.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Title</label>
              <Input value={dealDraft.title} onChange={(event) => setDealDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="Monthly uniform supply" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Value</label>
              <Input value={dealDraft.value} onChange={(event) => setDealDraft((prev) => ({ ...prev, value: event.target.value }))} placeholder="50000" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Probability</label>
              <Input value={dealDraft.probability} onChange={(event) => setDealDraft((prev) => ({ ...prev, probability: event.target.value }))} placeholder="40" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Stage</label>
              <Select value={dealDraft.stage} onChange={(event) => setDealDraft((prev) => ({ ...prev, stage: event.target.value as Deal['stage'] }))}>
                <option value="LEAD">Lead</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="PROPOSAL">Proposal</option>
                <option value="NEGOTIATION">Negotiation</option>
                <option value="CLOSED_WON">Won</option>
                <option value="CLOSED_LOST">Lost</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Expected close date</label>
              <Input type="date" value={dealDraft.expectedCloseDate} onChange={(event) => setDealDraft((prev) => ({ ...prev, expectedCloseDate: event.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Assigned to</label>
              <Input value={dealDraft.assignedTo} onChange={(event) => setDealDraft((prev) => ({ ...prev, assignedTo: event.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Product IDs</label>
              <Input value={dealDraft.productIds} onChange={(event) => setDealDraft((prev) => ({ ...prev, productIds: event.target.value }))} placeholder="prod_001, prod_002" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea
                value={dealDraft.notes}
                onChange={(event) => setDealDraft((prev) => ({ ...prev, notes: event.target.value }))}
                rows={4}
                className="min-h-24 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewDealOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateDeal}>
              Create deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(currentDeal)} onOpenChange={(open) => !open && setDealDetailId(null)}>
        <DialogOverlay />
        <DialogContent className="w-[min(94vw,42rem)]">
          {currentDeal ? (
            <>
              <DialogHeader>
                <DialogTitle>{currentDeal.title}</DialogTitle>
                <DialogDescription>Deal details and a quick path to change the stage.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Value</p>
                  <p className="mt-2 text-2xl font-semibold">{crmMoney.format(currentDeal.value)}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Probability</p>
                  <p className="mt-2 text-2xl font-semibold">{currentDeal.probability}%</p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Stage</label>
                  <Select value={currentDeal.stage} onChange={(event) => moveDealStage(currentDeal.id, event.target.value as Deal['stage'])}>
                    <option value="LEAD">Lead</option>
                    <option value="QUALIFIED">Qualified</option>
                    <option value="PROPOSAL">Proposal</option>
                    <option value="NEGOTIATION">Negotiation</option>
                    <option value="CLOSED_WON">Won</option>
                    <option value="CLOSED_LOST">Lost</option>
                  </Select>
                </div>
                <div>
                  <p className="mb-1 block text-sm font-medium">Assigned to</p>
                  <div className="rounded-2xl border bg-muted/20 p-3 text-sm">{currentDeal.assignedTo || 'Unassigned'}</div>
                </div>
                <div className="md:col-span-2">
                  <p className="mb-1 block text-sm font-medium">Expected close</p>
                  <div className="rounded-2xl border bg-muted/20 p-3 text-sm">{currentDeal.expectedCloseDate ? crmDate.format(new Date(currentDeal.expectedCloseDate)) : 'Not set'}</div>
                </div>
                {currentDeal.notes ? (
                  <div className="md:col-span-2 rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                    <p className="mt-2 text-sm text-foreground/90">{currentDeal.notes}</p>
                  </div>
                ) : null}
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDealDetailId(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={activityOpen} onOpenChange={setActivityOpen}>
        <DialogOverlay />
        <DialogContent className="w-[min(94vw,42rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log activity</DialogTitle>
            <DialogDescription>Capture calls, meetings, reminders, and follow-ups from one place.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <Select value={activityDraft.type} onChange={(event) => setActivityDraft((prev) => ({ ...prev, type: event.target.value as Activity['type'] }))}>
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
              <label className="mb-1 block text-sm font-medium">Status</label>
              <Select value={activityDraft.status} onChange={(event) => setActivityDraft((prev) => ({ ...prev, status: event.target.value as Activity['status'] }))}>
                <option value="SCHEDULED">Scheduled</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="MISSED">Missed</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Subject</label>
              <Input value={activityDraft.subject} onChange={(event) => setActivityDraft((prev) => ({ ...prev, subject: event.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea
                value={activityDraft.description}
                onChange={(event) => setActivityDraft((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
                className="min-h-20 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Outcome</label>
              <Input value={activityDraft.outcome} onChange={(event) => setActivityDraft((prev) => ({ ...prev, outcome: event.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Scheduled at</label>
              <Input type="datetime-local" value={activityDraft.scheduledAt} onChange={(event) => setActivityDraft((prev) => ({ ...prev, scheduledAt: event.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Duration minutes</label>
              <Input value={activityDraft.duration} onChange={(event) => setActivityDraft((prev) => ({ ...prev, duration: event.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActivityOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateActivity}>
              Save activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
