import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Layers3,
  Megaphone,
  PencilLine,
  Plus,
  Search,
  Eye,
  Users,
  X
} from 'lucide-react'
import { useAdminStore } from '@/lib/store'
import { useBillingStore } from '@/lib/billingStore'
import { usePosStore } from '@/lib/posStore'
import { useCRMStore } from '@/lib/crmStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { Contact, Segment, SegmentCondition } from '@/data/crm'
import {
  evaluateSegmentConditions,
  getSegmentFieldMeta,
  getSegmentFieldOptions,
  getSegmentFieldType,
  getSegmentOperators,
  type SegmentLogic,
  type SegmentMetrics
} from '@/lib/crmSegments'
import {
  crmDate,
  crmMoney,
  getContactAvatarClass,
  getContactDisplayName,
  getContactInitials,
  panelClassName,
  ratingVariant,
  statusVariant,
  typeVariant
} from './shared'

type SegmentDraft = {
  name: string
  description: string
  type: Segment['type']
  color: string
  conditionLogic: SegmentLogic
  conditions: SegmentCondition[]
  contactIds: string[]
}

type SelectChoiceMap = {
  type: string[]
  entityType: string[]
  source: string[]
  rating: string[]
  status: string[]
  assignedTo: string[]
}

const COLOR_PRESETS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#0f766e']

const todayInput = (): string => new Date().toISOString().slice(0, 10)

function formatMoney(value: number): string {
  return crmMoney.format(value)
}

function formatConditionValue(condition: SegmentCondition): string {
  if (condition.operator === 'IS_EMPTY') return 'empty'
  if (condition.field === 'totalSpent') return formatMoney(Number(condition.value ?? 0))
  if (condition.field === 'lastPurchaseDate') {
    if (condition.operator === 'IN_LAST_DAYS') return `last ${condition.value ?? 0} days`
    if (condition.operator === 'OLDER_THAN_DAYS') return `older than ${condition.value ?? 0} days`
    if (condition.operator === 'BEFORE_DATE') return `before ${String(condition.value ?? '')}`
    if (condition.operator === 'AFTER_DATE') return `after ${String(condition.value ?? '')}`
    if (condition.operator === 'ON') return String(condition.value ?? '')
  }
  if (typeof condition.value === 'string' && condition.value.trim()) return condition.value
  if (typeof condition.value === 'number') return String(condition.value)
  if (typeof condition.value === 'boolean') return condition.value ? 'true' : 'false'
  return 'any'
}

function buildSelectChoices(contacts: Contact[], defaultAssignee: string): SelectChoiceMap {
  return {
    type: ['CUSTOMER', 'LEAD', 'VENDOR', 'PARTNER'],
    entityType: ['INDIVIDUAL', 'BUSINESS'],
    source: ['WALK_IN', 'REFERRAL', 'WEBSITE', 'SOCIAL_MEDIA', 'COLD_CALL', 'EXHIBITION', 'OTHER'],
    rating: ['HOT', 'WARM', 'COLD'],
    status: ['ACTIVE', 'INACTIVE', 'BLOCKED'],
    assignedTo: [...new Set([defaultAssignee, ...contacts.map((contact) => contact.assignedTo).filter((value): value is string => Boolean(value))])]
  }
}

function buildDefaultCondition(
  field: SegmentCondition['field'],
  customFields: string[],
  contacts: Contact[],
  defaultAssignee: string,
  operator?: SegmentCondition['operator']
): SegmentCondition {
  const meta = getSegmentFieldMeta(field, customFields)
  const selectedOperator = operator ?? getSegmentOperators(meta.type)[0].value
  const selectChoices = buildSelectChoices(contacts, defaultAssignee)

  if (meta.type === 'number') {
    return {
      field,
      operator: selectedOperator,
      value: selectedOperator === 'IN_LAST_DAYS' || selectedOperator === 'OLDER_THAN_DAYS' ? 30 : 0
    }
  }

  if (meta.type === 'date') {
    return {
      field,
      operator: selectedOperator,
      value: selectedOperator === 'IN_LAST_DAYS' || selectedOperator === 'OLDER_THAN_DAYS' ? 30 : todayInput()
    }
  }

  if (meta.type === 'select') {
    const defaultValues = selectChoices[field as keyof SelectChoiceMap] ?? []
    return {
      field,
      operator: selectedOperator,
      value: defaultValues[0] ?? ''
    }
  }

  if (meta.type === 'boolean') {
    return {
      field,
      operator: selectedOperator,
      value: true
    }
  }

  return {
    field,
    operator: selectedOperator,
    value: ''
  }
}

function initialDraft(contacts: Contact[], customFields: string[], defaultAssignee: string, type: Segment['type'] = 'STATIC'): SegmentDraft {
  return {
    name: '',
    description: '',
    type,
    color: COLOR_PRESETS[0],
    conditionLogic: 'AND',
    conditions: [buildDefaultCondition('type', customFields, contacts, defaultAssignee, 'EQUALS')],
    contactIds: []
  }
}

function emptyMetrics(): SegmentMetrics {
  return { totalSpent: 0, purchaseCount: 0, lastPurchaseDate: undefined }
}

function getConditionInputKind(condition: SegmentCondition, customFields: string[]): 'text' | 'number' | 'date' | 'select' | 'boolean' {
  const fieldType = getSegmentFieldType(condition.field, customFields)
  if (fieldType === 'date') {
    return condition.operator === 'IN_LAST_DAYS' || condition.operator === 'OLDER_THAN_DAYS' ? 'number' : 'date'
  }
  if (fieldType === 'number') {
    return 'number'
  }
  if (fieldType === 'select') {
    return 'select'
  }
  if (fieldType === 'boolean') {
    return 'boolean'
  }
  return 'text'
}

function formatFieldSummary(condition: SegmentCondition, customFields: string[]): string {
  const meta = getSegmentFieldMeta(condition.field, customFields)
  return `${meta.label} ${condition.operator.replace(/_/g, ' ').toLowerCase()} ${formatConditionValue(condition)}`
}

export default function SegmentsView() {
  const { segments, contacts, settings, createSegment, updateSegment, evaluateDynamicSegment, computeContactScore } = useCRMStore()
  const { customers, orders } = useAdminStore()
  const { invoices, payments } = useBillingStore()
  const { orders: posOrders } = usePosStore()

  const [segmentModalOpen, setSegmentModalOpen] = useState(false)
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [draft, setDraft] = useState<SegmentDraft>(() => initialDraft(contacts, settings.customContactFields, settings.defaultAssignee))
  const [staticSearch, setStaticSearch] = useState('')
  const [dynamicSearch, setDynamicSearch] = useState('')

  const selectChoices = useMemo(() => buildSelectChoices(contacts, settings.defaultAssignee), [contacts, settings.defaultAssignee])
  const fieldOptions = useMemo(() => getSegmentFieldOptions(settings.customContactFields), [settings.customContactFields])
  const groupedFieldOptions = useMemo(() => {
    return fieldOptions.reduce<Record<string, (typeof fieldOptions)[number][]>>((groups, option) => {
      groups[option.group] = groups[option.group] || []
      groups[option.group].push(option)
      return groups
    }, {})
  }, [fieldOptions])

  const purchaseMetricsByContact = useMemo(() => {
    const map = new Map<string, SegmentMetrics>()

    for (const contact of contacts) {
      const customerId = contact.linkedCustomerId || undefined
      const customer = customers.find((item) => item.id === customerId)
      const relatedInvoices = invoices.filter((invoice) => invoice.customerId === customerId)
      const relatedPosOrders = posOrders.filter((order) => {
        const orderName = (order.customerName || '').toLowerCase()
        const orderPhone = (order.customerPhone || '').replace(/\D/g, '')
        return (
          (contact.phone && orderPhone === contact.phone.replace(/\D/g, '')) ||
          (contact.whatsapp && orderPhone === contact.whatsapp.replace(/\D/g, '')) ||
          orderName === contact.displayName.toLowerCase()
        )
      })

      const totalSpent =
        (customer?.totalSpent ?? 0) +
        relatedInvoices.reduce((sum, invoice) => sum + invoice.taxBreakdown.grandTotal, 0) +
        relatedPosOrders.reduce((sum, order) => sum + order.total, 0)

      const purchaseDates = [
        ...(customer?.orderIds?.map((orderId) => orders.find((order) => order.id === orderId)?.date || '') ?? []),
        ...relatedInvoices.map((invoice) => invoice.issueDate),
        ...relatedPosOrders.map((order) => order.completedAt)
      ]
        .filter(Boolean)
        .sort()

      map.set(contact.id, {
        totalSpent,
        lastPurchaseDate: purchaseDates.slice(-1)[0],
        purchaseCount: (customer?.orderIds?.length ?? 0) + relatedInvoices.length + relatedPosOrders.length
      })
    }

    return map
  }, [contacts, customers, invoices, orders, posOrders])

  const enrichedSegments = useMemo(() => {
    return segments.map((segment) => {
      const contactIds = segment.type === 'DYNAMIC' ? evaluateDynamicSegment(segment.id) : segment.contactIds
      const segmentContacts = contacts.filter((contact) => contactIds.includes(contact.id))
      const avgScore = segmentContacts.length
        ? segmentContacts.reduce((sum, contact) => sum + computeContactScore(contact.id), 0) / segmentContacts.length
        : 0

      return {
        ...segment,
        contactIds,
        segmentContacts,
        avgScore
      }
    })
  }, [computeContactScore, contacts, evaluateDynamicSegment, segments])

  const selectedSegment = selectedSegmentId ? enrichedSegments.find((segment) => segment.id === selectedSegmentId) ?? null : null
  const selectedSegmentContacts = selectedSegment?.segmentContacts ?? []
  const selectedSegmentFieldSummary = selectedSegment
    ? selectedSegment.type === 'DYNAMIC'
      ? selectedSegment.conditions.map((condition) => formatFieldSummary(condition, settings.customContactFields)).join(` ${selectedSegment.conditionLogic || 'AND'} `)
      : `${selectedSegment.contactIds.length} manually selected contacts`
    : ''

  const staticContacts = useMemo(() => {
    const q = staticSearch.trim().toLowerCase()
    return contacts.filter((contact) => {
      if (!q) return true
      return [getContactDisplayName(contact), contact.company, contact.phone, contact.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q))
    })
  }, [contacts, staticSearch])

  const draftPreviewContacts = useMemo(() => {
    if (draft.type === 'STATIC') {
      return contacts.filter((contact) => draft.contactIds.includes(contact.id))
    }

    const searchable = dynamicSearch.trim().toLowerCase()
    return contacts
      .filter((contact) => {
        if (searchable) {
          const matchesSearch = [getContactDisplayName(contact), contact.company, contact.city, contact.state, contact.tags.join(' ')]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(searchable))
          if (!matchesSearch) return false
        }
        const metrics = purchaseMetricsByContact.get(contact.id) || emptyMetrics()
        return evaluateSegmentConditions(contact, draft.conditions, draft.conditionLogic, computeContactScore(contact.id), metrics)
      })
      .sort((a, b) => getContactDisplayName(a).localeCompare(getContactDisplayName(b)))
  }, [computeContactScore, contacts, draft.conditions, draft.conditionLogic, draft.type, draft.contactIds, dynamicSearch, purchaseMetricsByContact])

  const draftPreviewCount = draft.type === 'STATIC' ? draft.contactIds.length : draftPreviewContacts.length

  const segmentStats = useMemo(() => {
    const total = segments.length
    const dynamic = segments.filter((segment) => segment.type === 'DYNAMIC').length
    const covered = new Set(enrichedSegments.flatMap((segment) => segment.contactIds)).size
    return { total, dynamic, covered }
  }, [enrichedSegments, segments.length])

  const openCreateSegment = (type: Segment['type'] = 'STATIC') => {
    setEditingSegmentId(null)
    setStaticSearch('')
    setDynamicSearch('')
    setDraft(initialDraft(contacts, settings.customContactFields, settings.defaultAssignee, type))
    setSegmentModalOpen(true)
  }

  const openEditSegment = (segment: Segment) => {
    setEditingSegmentId(segment.id)
    setStaticSearch('')
    setDynamicSearch('')
    setDraft({
      name: segment.name,
      description: segment.description || '',
      type: segment.type,
      color: segment.color,
      conditionLogic: segment.conditionLogic || 'AND',
      conditions: segment.type === 'DYNAMIC' && segment.conditions.length
        ? segment.conditions
        : [buildDefaultCondition('type', settings.customContactFields, contacts, settings.defaultAssignee, 'EQUALS')],
      contactIds: segment.type === 'STATIC' ? segment.contactIds : []
    })
    setSegmentModalOpen(true)
  }

  const closeSegmentModal = () => {
    setSegmentModalOpen(false)
    setEditingSegmentId(null)
  }

  const handleSaveSegment = () => {
    if (!draft.name.trim()) return

    const payload: Segment = {
      id: editingSegmentId || `crm-seg-${Date.now().toString(36)}`,
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      type: draft.type,
      conditionLogic: draft.type === 'DYNAMIC' ? draft.conditionLogic : undefined,
      conditions: draft.type === 'DYNAMIC' ? draft.conditions : [],
      contactIds: draft.type === 'STATIC' ? [...new Set(draft.contactIds)] : [],
      color: draft.color,
      createdAt: editingSegmentId ? (segments.find((segment) => segment.id === editingSegmentId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    if (editingSegmentId) {
      updateSegment(payload)
    } else {
      createSegment(payload)
    }

    closeSegmentModal()
  }

  const updateCondition = (index: number, next: SegmentCondition) => {
    setDraft((prev) => ({
      ...prev,
      conditions: prev.conditions.map((condition, conditionIndex) => (conditionIndex === index ? next : condition))
    }))
  }

  const setConditionField = (index: number, field: SegmentCondition['field']) => {
    const next = buildDefaultCondition(field, settings.customContactFields, contacts, settings.defaultAssignee)
    updateCondition(index, next)
  }

  const setConditionOperator = (index: number, operator: SegmentCondition['operator']) => {
    const current = draft.conditions[index]
    if (!current) return
    const meta = getSegmentFieldMeta(current.field, settings.customContactFields)
    const next = buildDefaultCondition(current.field, settings.customContactFields, contacts, settings.defaultAssignee, operator)
    if (meta.type === 'text' && operator === 'IS_EMPTY') {
      next.value = ''
    }
    updateCondition(index, next)
  }

  const toggleStaticContact = (contactId: string) => {
    setDraft((prev) => ({
      ...prev,
      contactIds: prev.contactIds.includes(contactId)
        ? prev.contactIds.filter((id) => id !== contactId)
        : [...prev.contactIds, contactId]
    }))
  }

  const addCondition = () => {
    setDraft((prev) => ({
      ...prev,
      conditions: [...prev.conditions, buildDefaultCondition('city', settings.customContactFields, contacts, settings.defaultAssignee, 'EQUALS')]
    }))
  }

  const removeCondition = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      conditions: prev.conditions.length > 1 ? prev.conditions.filter((_, conditionIndex) => conditionIndex !== index) : prev.conditions
    }))
  }

  const renderConditionValue = (condition: SegmentCondition, index: number) => {
    const inputKind = getConditionInputKind(condition, settings.customContactFields)

    if (inputKind === 'select') {
      const options =
        condition.field === 'type'
          ? selectChoices.type
          : condition.field === 'entityType'
            ? selectChoices.entityType
            : condition.field === 'source'
              ? selectChoices.source
              : condition.field === 'rating'
                ? selectChoices.rating
                : condition.field === 'status'
                  ? selectChoices.status
                  : condition.field === 'assignedTo'
                    ? selectChoices.assignedTo
                    : []

      return (
        <Select
          value={String(condition.value ?? '')}
          onChange={(event) => updateCondition(index, { ...condition, value: event.target.value })}
        >
          <option value="">Select value</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      )
    }

    if (inputKind === 'boolean') {
      return (
        <Select
          value={String(condition.value ?? 'true')}
          onChange={(event) => updateCondition(index, { ...condition, value: event.target.value === 'true' })}
        >
          <option value="true">True</option>
          <option value="false">False</option>
        </Select>
      )
    }

    if (inputKind === 'number') {
      return (
        <Input
          type="number"
          value={String(condition.value ?? '')}
          onChange={(event) =>
            updateCondition(index, {
              ...condition,
              value: event.target.value === '' ? '' : Number(event.target.value)
            })
          }
          placeholder="Enter number"
        />
      )
    }

    if (inputKind === 'date') {
      return (
        <Input
          type="date"
          value={String(condition.value ?? '')}
          onChange={(event) => updateCondition(index, { ...condition, value: event.target.value })}
        />
      )
    }

    return (
      <Input
        value={String(condition.value ?? '')}
        onChange={(event) => updateCondition(index, { ...condition, value: event.target.value })}
        placeholder="Enter value"
      />
    )
  }

  const renderContactTable = (segmentContacts: Contact[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Avatar + Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Company</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Last Contacted</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Rating</TableHead>
          <TableHead>Assigned To</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {segmentContacts.length ? (
          segmentContacts.map((contact) => (
            <TableRow key={contact.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold', getContactAvatarClass(contact.displayName))}>
                    {getContactInitials(getContactDisplayName(contact))}
                  </div>
                  <div>
                    <p className="font-medium">{getContactDisplayName(contact)}</p>
                    <p className="text-xs text-muted-foreground">{contact.city || contact.state || 'No location'}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={typeVariant(contact.type)}>{contact.type}</Badge>
              </TableCell>
              <TableCell>{contact.company || '—'}</TableCell>
              <TableCell>{contact.phone || contact.whatsapp || '—'}</TableCell>
              <TableCell>{contact.lastContactedAt ? crmDate.format(new Date(contact.lastContactedAt)) : 'Never'}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {contact.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                  {contact.tags.length > 3 ? <Badge variant="secondary">+{contact.tags.length - 3}</Badge> : null}
                </div>
              </TableCell>
              <TableCell>{contact.rating ? <Badge variant={ratingVariant(contact.rating)}>{contact.rating}</Badge> : '—'}</TableCell>
              <TableCell>{contact.assignedTo || 'Unassigned'}</TableCell>
              <TableCell className="text-right">
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/admin/crm/contacts/${contact.id}`}>
                    View
                    <Users className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={9}>
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No contacts matched this segment.</div>
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )

  return (
    <div className="dash-view space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Segments</h1>
          <p className="text-sm text-muted-foreground">Group contacts by behavior, value, and follow-up needs without manual tagging.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/crm/campaigns">
              <Layers3 className="mr-2 h-4 w-4" />
              Campaigns
            </Link>
          </Button>
          <Button type="button" onClick={() => openCreateSegment('STATIC')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Segment
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total segments</p>
            <p className="mt-2 text-2xl font-semibold">{segmentStats.total.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Dynamic segments</p>
            <p className="mt-2 text-2xl font-semibold">{segmentStats.dynamic.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Contacts covered</p>
            <p className="mt-2 text-2xl font-semibold">{segmentStats.covered.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {enrichedSegments.map((segment) => (
          <Card
            key={segment.id}
            className={cn(panelClassName('cursor-pointer overflow-hidden transition-shadow hover:shadow-[0_18px_55px_rgba(15,23,42,0.12)]'))}
            onClick={() => setSelectedSegmentId(segment.id)}
          >
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                    <CardTitle className="text-lg">{segment.name}</CardTitle>
                  </div>
                  <CardDescription className="line-clamp-2">{segment.description || 'No description provided.'}</CardDescription>
                </div>
                <Badge variant={segment.type === 'DYNAMIC' ? 'default' : 'secondary'}>{segment.type}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Contacts</p>
                  <p className="mt-1 text-lg font-semibold">{segment.contactIds.length}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Average score</p>
                  <p className="mt-1 text-lg font-semibold">{Math.round(segment.avgScore)}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Color</p>
                  <p className="mt-1 text-lg font-semibold">{segment.color}</p>
                </div>
                <div className="rounded-2xl border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
                  <p className="mt-1 text-lg font-semibold">{crmDate.format(new Date(segment.updatedAt || segment.createdAt))}</p>
                </div>
              </div>

              {segment.type === 'DYNAMIC' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{segment.conditionLogic || 'AND'}</Badge>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Conditions</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {segment.conditions.map((condition, index) => (
                      <Badge key={`${segment.id}-${index}`} variant="secondary">
                        {formatFieldSummary(condition, settings.customContactFields)}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview</p>
                <div className="flex flex-wrap gap-2">
                  {segment.segmentContacts.slice(0, 6).map((contact) => (
                    <Badge key={contact.id} variant="default" className="bg-slate-900 text-white">
                      {getContactDisplayName(contact)}
                    </Badge>
                  ))}
                  {!segment.segmentContacts.length ? <span className="text-sm text-muted-foreground">No contacts matched yet.</span> : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-xs text-muted-foreground">
                  Created {crmDate.format(new Date(segment.createdAt))}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedSegmentId(segment.id)
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View contacts
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      openEditSegment(segment)
                    }}
                  >
                    <PencilLine className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    asChild
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Link to={`/admin/crm/campaigns?segment=${segment.id}`}>
                      <Megaphone className="mr-2 h-4 w-4" />
                      Campaign
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={segmentModalOpen} onOpenChange={setSegmentModalOpen}>
        <DialogOverlay className="bg-slate-950/70 backdrop-blur-md" />
        <DialogContent className="w-[min(96vw,72rem)] max-h-[90vh] overflow-y-auto border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5">
          <DialogHeader>
            <DialogTitle>{editingSegmentId ? 'Edit Segment' : 'Create Segment'}</DialogTitle>
            <DialogDescription>
              {draft.type === 'STATIC'
                ? 'Pick contacts manually for a simple, fixed group.'
                : 'Build rules from contact fields and see the matching count change as you refine the segment.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {(['STATIC', 'DYNAMIC'] as const).map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={draft.type === type ? 'default' : 'outline'}
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      type,
                      conditions: type === 'DYNAMIC' ? (prev.conditions.length ? prev.conditions : [buildDefaultCondition('type', settings.customContactFields, contacts, settings.defaultAssignee, 'EQUALS')]) : prev.conditions,
                      contactIds: type === 'STATIC' ? prev.contactIds : prev.contactIds
                    }))
                  }
                >
                  {type === 'STATIC' ? 'Static' : 'Dynamic'}
                </Button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <Input value={draft.name} onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="High Value Customers" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Color</label>
                <div className="flex items-center gap-3">
                  <Input
                    type="color"
                    value={draft.color}
                    onChange={(event) => setDraft((prev) => ({ ...prev, color: event.target.value }))}
                    className="h-10 w-16 p-1"
                  />
                  <div className="flex flex-wrap gap-2">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={cn('h-8 w-8 rounded-full border-2 transition-transform hover:scale-105', draft.color === color ? 'border-slate-900' : 'border-transparent')}
                        style={{ backgroundColor: color }}
                        onClick={() => setDraft((prev) => ({ ...prev, color }))}
                        aria-label={`Use color ${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea
                  value={draft.description}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                  rows={3}
                  className="min-h-24 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="What should this segment be used for?"
                />
              </div>
            </div>

            {draft.type === 'STATIC' ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">Contact picker</p>
                    <p className="text-xs text-muted-foreground">Search and select the contacts that belong in this fixed group.</p>
                  </div>
                  <div className="relative w-full sm:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={staticSearch}
                      onChange={(event) => setStaticSearch(event.target.value)}
                      placeholder="Search contacts"
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="max-h-[28rem] overflow-y-auto rounded-2xl border">
                  <div className="space-y-2 p-3">
                    {staticContacts.map((contact) => {
                      const checked = draft.contactIds.includes(contact.id)
                      return (
                        <label
                          key={contact.id}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors',
                            checked ? 'border-primary bg-primary/5' : 'border-border/70 bg-background hover:bg-muted/40'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleStaticContact(contact.id)}
                            className="mt-1 h-4 w-4 rounded border-input"
                          />
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{getContactDisplayName(contact)}</p>
                              <Badge variant={typeVariant(contact.type)}>{contact.type}</Badge>
                              {contact.rating ? <Badge variant={ratingVariant(contact.rating)}>{contact.rating}</Badge> : null}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {contact.company || contact.designation || 'No company linked'} · {contact.phone || contact.whatsapp || 'No phone'}
                            </p>
                          </div>
                        </label>
                      )
                    })}
                    {!staticContacts.length ? <p className="p-4 text-center text-sm text-muted-foreground">No contacts matched your search.</p> : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">Condition builder</p>
                    <p className="text-xs text-muted-foreground">Add rules and choose whether every rule must match or just one.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Match</span>
                    <Select value={draft.conditionLogic} onChange={(event) => setDraft((prev) => ({ ...prev, conditionLogic: event.target.value as SegmentLogic }))} className="min-w-32">
                      <option value="AND">All rules</option>
                      <option value="OR">Any rule</option>
                    </Select>
                  </div>
                </div>

                <div className="space-y-3">
                  {draft.conditions.map((condition, index) => {
                    const meta = getSegmentFieldMeta(condition.field, settings.customContactFields)
                    const operators = getSegmentOperators(meta.type)
                    return (
                      <div key={`${String(condition.field)}-${index}`} className="grid gap-3 rounded-2xl border bg-muted/20 p-4 lg:grid-cols-[1.3fr_1fr_1.1fr_auto]">
                        <div>
                          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Field</label>
                          <Select value={String(condition.field)} onChange={(event) => setConditionField(index, event.target.value as SegmentCondition['field'])}>
                            {Object.entries(groupedFieldOptions).map(([group, options]) => (
                              <optgroup key={group} label={group}>
                                {options.map((option) => (
                                  <option key={String(option.value)} value={String(option.value)}>
                                    {option.label}
                                  </option>
                                ))}
                              </optgroup>
                            ))}
                          </Select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Operator</label>
                          <Select value={condition.operator} onChange={(event) => setConditionOperator(index, event.target.value as SegmentCondition['operator'])}>
                            {operators.map((operator) => (
                              <option key={operator.value} value={operator.value}>
                                {operator.label}
                              </option>
                            ))}
                          </Select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">Value</label>
                          {renderConditionValue(condition, index)}
                        </div>

                        <div className="flex items-end justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeCondition(index)}
                            disabled={draft.conditions.length === 1}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <Button type="button" variant="outline" onClick={addCondition}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add condition
                </Button>

                <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Live preview</p>
                    <p className="mt-2 text-3xl font-semibold">{draftPreviewCount.toLocaleString('en-IN')}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Contacts currently match this segment.</p>
                  </div>
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Matching contacts</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {draftPreviewContacts.slice(0, 6).map((contact) => (
                        <Badge key={contact.id} variant="secondary">
                          {getContactDisplayName(contact)}
                        </Badge>
                      ))}
                      {!draftPreviewContacts.length ? <span className="text-sm text-muted-foreground">No contacts yet.</span> : null}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeSegmentModal}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveSegment} disabled={!draft.name.trim() || (draft.type === 'STATIC' && !draft.contactIds.length)}>
              {editingSegmentId ? 'Save changes' : 'Create segment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedSegment)} onOpenChange={(open) => !open && setSelectedSegmentId(null)}>
        <DialogOverlay className="bg-slate-950/70 backdrop-blur-md" />
        <DialogContent className="w-[min(96vw,78rem)] max-h-[92vh] overflow-y-auto border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5">
          {selectedSegment ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className="inline-flex h-3 w-3 rounded-full" style={{ backgroundColor: selectedSegment.color }} />
                  {selectedSegment.name}
                </DialogTitle>
                <DialogDescription>
                  {selectedSegment.description || 'No description provided.'}
                  {selectedSegment.type === 'DYNAMIC' && selectedSegmentFieldSummary ? ` · ${selectedSegmentFieldSummary}` : ''}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 md:grid-cols-4">
                <Card className={panelClassName()}>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Contacts</p>
                    <p className="mt-2 text-2xl font-semibold">{selectedSegmentContacts.length.toLocaleString('en-IN')}</p>
                  </CardContent>
                </Card>
                <Card className={panelClassName()}>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
                    <p className="mt-2 text-2xl font-semibold">{selectedSegment.type}</p>
                  </CardContent>
                </Card>
                <Card className={panelClassName()}>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Updated</p>
                    <p className="mt-2 text-2xl font-semibold">{crmDate.format(new Date(selectedSegment.updatedAt || selectedSegment.createdAt))}</p>
                  </CardContent>
                </Card>
                <Card className={panelClassName()}>
                  <CardContent className="p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Color</p>
                    <p className="mt-2 text-2xl font-semibold">{selectedSegment.color}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <Link to={`/admin/crm/campaigns?segment=${selectedSegment.id}`}>
                    <Megaphone className="mr-2 h-4 w-4" />
                    Create Campaign for this Segment
                  </Link>
                </Button>
                <Button type="button" variant="outline" onClick={() => openEditSegment(selectedSegment)}>
                  <PencilLine className="mr-2 h-4 w-4" />
                  Edit Segment
                </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Contacts in segment</p>
                    <p className="text-xs text-muted-foreground">Same profile table as the Contacts view for quick scanning.</p>
                  </div>
                </div>
                {renderContactTable(selectedSegmentContacts)}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
