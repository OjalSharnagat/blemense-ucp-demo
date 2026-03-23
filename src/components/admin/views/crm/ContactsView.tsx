import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Download,
  LayoutGrid,
  Plus,
  PhoneCall,
  Search,
  Sheet,
  Table2,
  Trash2,
  Upload,
  UserPlus,
  UserSearch
} from 'lucide-react'
import { useCRMStore } from '@/lib/crmStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import {
  panelClassName,
  crmDate,
  getContactAvatarClass,
  getContactDisplayName,
  getContactInitials,
  getContactReference,
  ratingVariant,
  typeVariant,
  ScoreBadge
} from './shared'
import type { Contact } from '@/data/crm'

type ViewMode = 'table' | 'cards'
type SortField = 'name' | 'lastContactedAt' | 'createdAt' | 'score'
type QuickType = 'CUSTOMER' | 'LEAD' | 'VENDOR' | 'PARTNER'
type QuickSource = 'WALK_IN' | 'REFERRAL' | 'WEBSITE' | 'SOCIAL_MEDIA' | 'COLD_CALL' | 'EXHIBITION' | 'OTHER'
type ImportStep = 1 | 2 | 3

type QuickAddState = {
  name: string
  phone: string
  type: QuickType
  source: QuickSource
}

type ImportField =
  | 'displayName'
  | 'firstName'
  | 'lastName'
  | 'company'
  | 'designation'
  | 'email'
  | 'phone'
  | 'whatsapp'
  | 'city'
  | 'state'
  | 'pincode'
  | 'type'
  | 'source'
  | 'assignedTo'
  | 'tags'
  | 'status'

type ParsedCsv = {
  headers: string[]
  rows: string[][]
}

const VIEW_STORAGE_KEY = 'blemense-crm-contacts-view-mode'
const SAMPLE_CSV = `name,phone,type,source,email,company,assignedTo,tags,status
Aarav Mehta,+91-98200-11001,Customer,Walk In,aarav.mehta@example.com,Mehta Menswear,Naman Arora,repeat-buyer|fabric,Active
Metro Workwear,+91-80-4100-21021,Lead,Exhibition,purchase@metroworkwear.in,Metro Workwear,Meera Joshi,hot|uniforms,Active`

const IMPORT_FIELDS: Array<{ key: ImportField; label: string; required?: boolean }> = [
  { key: 'displayName', label: 'Display Name', required: true },
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'company', label: 'Company' },
  { key: 'designation', label: 'Designation' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'type', label: 'Type' },
  { key: 'source', label: 'Source' },
  { key: 'assignedTo', label: 'Assigned To' },
  { key: 'tags', label: 'Tags' },
  { key: 'status', label: 'Status' }
]

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let insideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"') {
      if (insideQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        insideQuotes = !insideQuotes
      }
      continue
    }

    if (char === ',' && !insideQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  cells.push(current.trim())
  return cells
}

function parseCsv(text: string): ParsedCsv {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) {
    return { headers: [], rows: [] }
  }

  const parsed = lines.map(parseCsvLine)
  return {
    headers: parsed[0] || [],
    rows: parsed.slice(1)
  }
}

function escapeCsv(value: unknown): string {
  const text = String(value ?? '')
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number | undefined>>) {
  const headers = rows.length ? Object.keys(rows[0]) : []
  const body = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))
  ].join('\n')

  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function splitName(name: string): { firstName: string; lastName: string; displayName: string } {
  const clean = name.trim()
  if (!clean) {
    return { firstName: '', lastName: '', displayName: '' }
  }

  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length <= 1) {
    return { firstName: clean, lastName: '', displayName: clean }
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    displayName: clean
  }
}

function inferHeader(headers: string[], candidates: string[]): string {
  const normalized = headers.map((header) => ({ header, normalized: normalize(header) }))
  for (const candidate of candidates) {
    const match = normalized.find((item) => item.normalized === normalize(candidate))
    if (match) return match.header
  }
  return ''
}

function getLastContacted(contact: Contact): string {
  return contact.lastContactedAt || contact.updatedAt || contact.createdAt
}

function getCreatedDate(contact: Contact): string {
  return contact.createdAt
}

function getScore(contact: Contact, computeContactScore: (contactId: string) => number): number {
  return computeContactScore(contact.id)
}

function buildContactFromQuickAdd(
  values: QuickAddState,
  defaultAssignee: string,
): Partial<Contact> {
  const nameParts = splitName(values.name)
  return {
    type: values.type,
    entityType: values.type === 'VENDOR' || values.type === 'PARTNER' ? 'BUSINESS' : 'INDIVIDUAL',
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    displayName: nameParts.displayName,
    phone: values.phone.trim(),
    source: values.source,
    assignedTo: defaultAssignee,
    status: 'ACTIVE',
    tags: [],
    customFields: {}
  }
}

export default function ContactsView() {
  const navigate = useNavigate()
  const {
    contacts,
    segments,
    settings,
    createContact,
    updateContact,
    deleteContact,
    updateSegment,
    logActivity,
    computeContactScore
  } = useCRMStore()

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'table'
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
    return stored === 'cards' ? 'cards' : 'table'
  })
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CUSTOMER' | 'LEAD' | 'VENDOR' | 'PARTNER'>('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'BLOCKED'>('ALL')
  const [assignedFilter, setAssignedFilter] = useState('ALL')
  const [sortField, setSortField] = useState<SortField>('score')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkAssignee, setBulkAssignee] = useState(settings.defaultAssignee)
  const [bulkTag, setBulkTag] = useState('')
  const [bulkSegmentId, setBulkSegmentId] = useState('')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [quickAdd, setQuickAdd] = useState<QuickAddState>({
    name: '',
    phone: '',
    type: 'CUSTOMER',
    source: 'WALK_IN'
  })
  const [importStep, setImportStep] = useState<ImportStep>(1)
  const [csvText, setCsvText] = useState(SAMPLE_CSV)
  const [parsedCsv, setParsedCsv] = useState<ParsedCsv>(() => parseCsv(SAMPLE_CSV))
  const [fieldMap, setFieldMap] = useState<Record<ImportField, string>>({} as Record<ImportField, string>)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode)
    }
  }, [viewMode])

  useEffect(() => {
    setBulkAssignee(settings.defaultAssignee)
  }, [settings.defaultAssignee])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => contacts.some((contact) => contact.id === id)))
  }, [contacts])

  useEffect(() => {
    const headers = parsedCsv.headers
    if (!headers.length) return

    const inferred: Record<ImportField, string> = {} as Record<ImportField, string>
    for (const field of IMPORT_FIELDS.map((entry) => entry.key)) {
      const candidates: Record<ImportField, string[]> = {
        displayName: ['displayName', 'name', 'contactName', 'contact'],
        firstName: ['firstName', 'fname', 'givenName'],
        lastName: ['lastName', 'lname', 'surname'],
        company: ['company', 'companyName', 'business'],
        designation: ['designation', 'role', 'title'],
        email: ['email', 'emailAddress', 'mail'],
        phone: ['phone', 'mobile', 'contact', 'contactNumber'],
        whatsapp: ['whatsapp', 'whatsApp', 'whatsappNumber'],
        city: ['city', 'town'],
        state: ['state', 'province'],
        pincode: ['pincode', 'pin', 'zip'],
        type: ['type', 'contactType'],
        source: ['source', 'leadSource'],
        assignedTo: ['assignedTo', 'owner', 'assignee'],
        tags: ['tags', 'tag'],
        status: ['status', 'stateStatus']
      }
      inferred[field] = inferHeader(headers, candidates[field] || [])
    }
    setFieldMap((prev) => ({ ...inferred, ...prev }))
  }, [parsedCsv.headers])

  const tags = useMemo(() => {
    return [...new Set(contacts.flatMap((contact) => contact.tags).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  }, [contacts])

  const assignees = useMemo(() => {
    return [...new Set(contacts.map((contact) => contact.assignedTo).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b))
  }, [contacts])

  const staticSegments = useMemo(() => segments.filter((segment) => segment.type === 'STATIC'), [segments])

  const contactMetrics = useMemo(() => {
    const total = contacts.length
    const customers = contacts.filter((contact) => contact.type === 'CUSTOMER').length
    const leads = contacts.filter((contact) => contact.type === 'LEAD').length
    const active = contacts.filter((contact) => contact.status === 'ACTIVE').length
    const hot = contacts.filter((contact) => contact.rating === 'HOT').length
    return { total, customers, leads, active, hot }
  }, [contacts])

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase()
    const base = contacts
      .map((contact) => ({ contact, score: getScore(contact, computeContactScore), lastContacted: getLastContacted(contact), createdAt: getCreatedDate(contact) }))
      .filter(({ contact }) => (typeFilter === 'ALL' ? true : contact.type === typeFilter))
      .filter(({ contact }) => (statusFilter === 'ALL' ? true : contact.status === statusFilter))
      .filter(({ contact }) => (assignedFilter === 'ALL' ? true : contact.assignedTo === assignedFilter))
      .filter(({ contact }) => (selectedTags.length ? selectedTags.every((tag) => contact.tags.includes(tag)) : true))
      .filter(({ contact }) => {
        if (!q) return true
        return [
          getContactDisplayName(contact),
          contact.phone,
          contact.email,
          contact.company,
          contact.designation,
          contact.city,
          contact.state,
          contact.tags.join(' '),
          contact.assignedTo
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q))
      })

    return base.sort((a, b) => {
      if (sortField === 'name') return a.contact.displayName.localeCompare(b.contact.displayName)
      if (sortField === 'lastContactedAt') return new Date(b.lastContacted).getTime() - new Date(a.lastContacted).getTime()
      if (sortField === 'createdAt') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return b.score - a.score
    })
  }, [assignedFilter, computeContactScore, contacts, search, selectedTags, sortField, statusFilter, typeFilter])

  const selectedContacts = useMemo(
    () => selectedIds.map((id) => contacts.find((contact) => contact.id === id)).filter((value): value is Contact => Boolean(value)),
    [contacts, selectedIds]
  )

  const allVisibleSelected = filteredContacts.length > 0 && filteredContacts.every(({ contact }) => selectedIds.includes(contact.id))

  const importPreview = useMemo(() => {
    const rows = parsedCsv.rows.slice(0, 5).map((row) => {
      const values = Object.fromEntries(parsedCsv.headers.map((header, index) => [header, row[index] ?? '']))
      const mapValue = (field: ImportField): string => {
        const header = fieldMap[field]
        return header ? String(values[header] ?? '') : ''
      }

      const displayName = mapValue('displayName') || [mapValue('firstName'), mapValue('lastName')].filter(Boolean).join(' ') || mapValue('company')
      return {
        displayName,
        type: mapValue('type') || 'CUSTOMER',
        phone: mapValue('phone'),
        email: mapValue('email'),
        source: mapValue('source'),
        assignedTo: mapValue('assignedTo'),
        tags: mapValue('tags')
      }
    })

    return rows
  }, [fieldMap, parsedCsv.headers, parsedCsv.rows])

  const handleToggleSelect = (contactId: string) => {
    setSelectedIds((prev) => (prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [contactId, ...prev]))
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? filteredContacts.map(({ contact }) => contact.id) : [])
  }

  const handleQuickAdd = () => {
    const { firstName, lastName, displayName } = splitName(quickAdd.name)
    const contact = createContact({
      type: quickAdd.type,
      entityType: quickAdd.type === 'VENDOR' || quickAdd.type === 'PARTNER' ? 'BUSINESS' : 'INDIVIDUAL',
      firstName,
      lastName,
      displayName,
      company: quickAdd.name.trim() || undefined,
      designation: undefined,
      email: undefined,
      phone: quickAdd.phone.trim(),
      altPhone: undefined,
      whatsapp: quickAdd.phone.trim(),
      address: undefined,
      city: undefined,
      state: undefined,
      pincode: undefined,
      gstin: undefined,
      pan: undefined,
      source: quickAdd.source,
      tags: [],
      assignedTo: settings.defaultAssignee,
      rating: quickAdd.type === 'LEAD' ? 'WARM' : undefined,
      status: 'ACTIVE',
      notes: '',
      linkedCustomerId: null,
      birthday: undefined,
      anniversary: undefined,
      customFields: {}
    } as any) as Contact
    setQuickAddOpen(false)
    setQuickAdd({ name: '', phone: '', type: 'CUSTOMER', source: 'WALK_IN' })
    navigate(`/admin/crm/contacts/${contact.id}`)
  }

  const applyBulkAssignee = () => {
    if (!selectedIds.length || !bulkAssignee.trim()) return
    selectedContacts.forEach((contact) => updateContact({ ...contact, assignedTo: bulkAssignee.trim() }))
  }

  const applyBulkTag = () => {
    if (!selectedIds.length || !bulkTag.trim()) return
    const tag = bulkTag.trim()
    selectedContacts.forEach((contact) => {
      const nextTags = [...new Set([...contact.tags, tag])]
      updateContact({ ...contact, tags: nextTags })
    })
    setBulkTag('')
  }

  const applyBulkSegment = () => {
    if (!selectedIds.length || !bulkSegmentId) return
    const segment = staticSegments.find((entry) => entry.id === bulkSegmentId)
    if (!segment) return
    updateSegment({
      ...segment,
      contactIds: [...new Set([...segment.contactIds, ...selectedIds])]
    })
  }

  const exportSelectedContacts = () => {
    if (!selectedContacts.length) return
    downloadCsv(
      'crm-contacts-export.csv',
      selectedContacts.map((contact) => ({
        name: getContactDisplayName(contact),
        type: contact.type,
        company: contact.company || '',
        phone: contact.phone || '',
        email: contact.email || '',
        lastContactedAt: contact.lastContactedAt || '',
        tags: contact.tags.join(' | '),
        rating: contact.rating || '',
        assignedTo: contact.assignedTo || ''
      }))
    )
  }

  const deleteSelectedContacts = () => {
    if (!selectedContacts.length) return
    const ok = window.confirm(`Delete ${selectedContacts.length} contact(s)? This cannot be undone.`)
    if (!ok) return
    selectedContacts.forEach((contact) => deleteContact(contact.id))
    setSelectedIds([])
  }

  const quickLog = (contact: Contact, type: 'CALL' | 'NOTE') => {
    logActivity({
      type,
      contactId: contact.id,
      subject: type === 'CALL' ? 'Quick call log' : 'Quick note',
      description: `Logged from Contacts view for ${getContactDisplayName(contact)}.`,
      outcome: type === 'CALL' ? 'Quick call logged' : 'Quick note added',
      completedAt: new Date().toISOString(),
      status: 'COMPLETED',
      createdBy: settings.defaultAssignee,
      attachments: []
    })
  }

  const submitImportPreview = () => {
    setParsedCsv(parseCsv(csvText))
    setImportStep(2)
  }

  useEffect(() => {
    if (!parsedCsv.headers.length) return
    setFieldMap((prev) => {
      const next = { ...prev }
      for (const field of IMPORT_FIELDS.map((entry) => entry.key)) {
        if (!next[field]) {
          next[field] = inferHeader(parsedCsv.headers, [field])
        }
      }
      return next
    })
  }, [parsedCsv.headers])

  useEffect(() => {
    if (importStep === 1 && parsedCsv.headers.length) {
      setImportStep(2)
    }
  }, [importStep, parsedCsv.headers.length])

  return (
    <div className="dash-view space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">Power-user browse, visual cards, bulk actions, import, and rapid entry in one workspace.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button type="button" variant="outline" onClick={() => setQuickAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Quick Add
          </Button>
          <Button asChild>
            <Link to="/admin/crm/contacts/new">
              <UserPlus className="mr-2 h-4 w-4" />
              Full Form
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Contacts</p>
            <p className="mt-2 text-2xl font-semibold">{contactMetrics.total.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Customers</p>
            <p className="mt-2 text-2xl font-semibold">{contactMetrics.customers.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active Leads</p>
            <p className="mt-2 text-2xl font-semibold">{contactMetrics.leads.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Hot Leads</p>
            <p className="mt-2 text-2xl font-semibold">{contactMetrics.hot.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
      </div>

      <Card className={panelClassName()}>
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Toolbar</CardTitle>
              <CardDescription>Search, filter, sort, and switch between compact and visual browsing.</CardDescription>
            </div>
            <div className="flex items-center gap-2 rounded-xl border bg-muted/20 p-1">
              <Button
                type="button"
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
              >
                <Table2 className="mr-2 h-4 w-4" />
                Table
              </Button>
              <Button
                type="button"
                variant={viewMode === 'cards' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('cards')}
              >
                <LayoutGrid className="mr-2 h-4 w-4" />
                Cards
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 xl:grid-cols-[1.6fr_repeat(4,minmax(0,0.9fr))]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Search name, phone, email, company" />
            </div>
            <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
              <option value="ALL">All Types</option>
              <option value="CUSTOMER">Customer</option>
              <option value="LEAD">Lead</option>
              <option value="VENDOR">Vendor</option>
              <option value="PARTNER">Partner</option>
            </Select>
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLOCKED">Blocked</option>
            </Select>
            <Select value={assignedFilter} onChange={(event) => setAssignedFilter(event.target.value)}>
              <option value="ALL">All Assignees</option>
              {assignees.map((assignee) => (
                <option key={assignee} value={assignee}>
                  {assignee}
                </option>
              ))}
            </Select>
            <Select value={sortField} onChange={(event) => setSortField(event.target.value as SortField)}>
              <option value="score">Sort by Score</option>
              <option value="name">Sort by Name</option>
              <option value="lastContactedAt">Sort by Last Contacted</option>
              <option value="createdAt">Sort by Created Date</option>
            </Select>
          </div>

          <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr_1fr]">
            <div>
              <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Tag filter</p>
              <select
                multiple
                size={Math.min(6, Math.max(3, tags.length || 3))}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                value={selectedTags}
                onChange={(event) => setSelectedTags(Array.from(event.currentTarget.selectedOptions).map((option) => option.value))}
              >
                {tags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-muted-foreground">Hold Ctrl/Command to select multiple tags.</p>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Selected tags</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedTags.length ? (
                  selectedTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="capitalize">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">None selected</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">View preference</p>
              <p className="mt-2 text-sm text-muted-foreground">Saved in localStorage for the next visit.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedIds.length ? (
        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Bulk actions</CardTitle>
                <CardDescription>{selectedIds.length.toLocaleString('en-IN')} contact(s) selected.</CardDescription>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedIds([])}>
                Clear selection
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 xl:grid-cols-[1fr_1fr_1fr_auto_auto]">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Assign to</p>
              <Input value={bulkAssignee} onChange={(event) => setBulkAssignee(event.target.value)} placeholder="Assignee name" />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Add tag</p>
              <Input value={bulkTag} onChange={(event) => setBulkTag(event.target.value)} placeholder="festival" />
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Add to segment</p>
              <Select value={bulkSegmentId} onChange={(event) => setBulkSegmentId(event.target.value)}>
                <option value="">Choose a static segment</option>
                {staticSegments.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" className="w-full" onClick={applyBulkAssignee}>
                Assign
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Button type="button" variant="outline" onClick={applyBulkTag}>
                Add Tag
              </Button>
              <Button type="button" variant="outline" onClick={applyBulkSegment}>
                Add to Segment
              </Button>
              <Button type="button" variant="outline" onClick={exportSelectedContacts}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
              <Button type="button" variant="destructive" onClick={deleteSelectedContacts}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {viewMode === 'table' ? (
        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Table view</CardTitle>
            <CardDescription>Best for power users who want to scan fields quickly.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={(event) => handleSelectAll(event.target.checked)}
                      aria-label="Select all visible contacts"
                    />
                  </TableHead>
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
                {filteredContacts.map(({ contact, score }) => {
                  const selected = selectedIds.includes(contact.id)
                  const lastContacted = getLastContacted(contact)

                  return (
                    <TableRow key={contact.id} data-state={selected ? 'selected' : undefined}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => handleToggleSelect(contact.id)}
                          aria-label={`Select ${getContactDisplayName(contact)}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Link to={`/admin/crm/contacts/${contact.id}`} className="flex items-center gap-3 hover:text-primary">
                          <div className={cn('flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold', getContactAvatarClass(getContactDisplayName(contact)))}>
                            {getContactInitials(getContactDisplayName(contact))}
                          </div>
                          <div>
                            <p className="font-medium">{getContactDisplayName(contact)}</p>
                            <p className="text-xs text-muted-foreground">{contact.email || contact.phone || 'No contact details'}</p>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant={typeVariant(contact.type)}>{contact.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{contact.company || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{contact.phone || contact.whatsapp || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{lastContacted ? crmDate.format(new Date(lastContacted)) : 'Not contacted'}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {contact.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="capitalize">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.type === 'LEAD' ? <Badge variant={ratingVariant(contact.rating)}>{contact.rating || 'N/A'}</Badge> : <ScoreBadge score={score} />}
                      </TableCell>
                      <TableCell>{contact.assignedTo || 'Unassigned'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button type="button" size="sm" variant="ghost" onClick={() => quickLog(contact, 'CALL')}>
                            <PhoneShortcut />
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => quickLog(contact, 'NOTE')}>
                            <NoteShortcut />
                          </Button>
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/admin/crm/contacts/${contact.id}`}>View</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}

                {!filteredContacts.length ? (
                  <TableRow>
                    <TableCell colSpan={10}>
                      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
                        <UserSearch className="h-10 w-10 text-muted-foreground/60" />
                        <p className="font-medium text-foreground">No contacts found.</p>
                        <p className="text-sm">Try a different search or clear some filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredContacts.map(({ contact, score }) => {
            const selected = selectedIds.includes(contact.id)
            const lastContacted = getLastContacted(contact)
            return (
              <Card key={contact.id} className={panelClassName(cn('relative overflow-hidden', selected ? 'ring-2 ring-primary' : ''))}>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selected}
                        onChange={() => handleToggleSelect(contact.id)}
                        aria-label={`Select ${getContactDisplayName(contact)}`}
                      />
                      <div className={cn('flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold', getContactAvatarClass(getContactDisplayName(contact)))}>
                        {getContactInitials(getContactDisplayName(contact))}
                      </div>
                    </label>
                    <Badge variant={typeVariant(contact.type)}>{contact.type}</Badge>
                  </div>

                  <div>
                    <p className="text-lg font-semibold">{getContactDisplayName(contact)}</p>
                    <p className="text-sm text-muted-foreground">{contact.company || getContactReference(contact) || 'No company added'}</p>
                  </div>

                  <div className="space-y-2 text-sm">
                    <p>{contact.phone || contact.whatsapp || 'No phone'}</p>
                    <p className="text-muted-foreground">
                      Last activity: {lastContacted ? crmDate.format(new Date(lastContacted)) : 'Not contacted yet'}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {contact.tags.slice(0, 4).map((tag) => (
                      <Badge key={tag} variant="secondary" className="capitalize">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    {contact.type === 'LEAD' ? <Badge variant={ratingVariant(contact.rating)}>{contact.rating || 'N/A'}</Badge> : <ScoreBadge score={score} />}
                    <p className="text-xs text-muted-foreground">Assigned to {contact.assignedTo || 'nobody'}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => quickLog(contact, 'CALL')}>
                      <PhoneShortcut />
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => quickLog(contact, 'NOTE')}>
                      <NoteShortcut />
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/admin/crm/contacts/${contact.id}`}>Profile</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}

          {!filteredContacts.length ? (
            <Card className={panelClassName('md:col-span-2 xl:col-span-3')}>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-center text-muted-foreground">
                <UserSearch className="h-10 w-10 text-muted-foreground/60" />
                <p className="font-medium text-foreground">No contacts found.</p>
                <p className="text-sm">Try a broader search or clear filters.</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}

      <Card className={panelClassName()}>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Browse summary</CardTitle>
          <CardDescription>Useful at a glance while the rest of the page stays compact.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Active contacts</p>
            <p className="mt-2 text-2xl font-semibold">{contactMetrics.active.toLocaleString('en-IN')}</p>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Leads</p>
            <p className="mt-2 text-2xl font-semibold">{contactMetrics.leads.toLocaleString('en-IN')}</p>
          </div>
          <div className="rounded-xl border bg-muted/20 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Open tasks</p>
            <p className="mt-2 text-2xl font-semibold">{selectedIds.length ? selectedIds.length.toLocaleString('en-IN') : '0'}</p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogOverlay />
        <DialogContent className="!left-auto !right-0 !top-0 !h-full !w-[min(94vw,32rem)] !translate-x-0 !translate-y-0 overflow-y-auto rounded-none border-l border-slate-200 bg-white p-0 shadow-2xl">
          <div className="flex h-full flex-col">
            <DialogHeader className="border-b bg-slate-50 px-6 py-5">
              <DialogTitle>Quick Add Contact</DialogTitle>
              <DialogDescription>Fast entry for the owner or salesperson. Fill the essentials now, details later.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 px-6 py-5">
              <div>
                <label className="mb-1 block text-sm font-medium">Name</label>
                <Input value={quickAdd.name} onChange={(event) => setQuickAdd((prev) => ({ ...prev, name: event.target.value }))} placeholder="Aarav Mehta" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Phone</label>
                <Input value={quickAdd.phone} onChange={(event) => setQuickAdd((prev) => ({ ...prev, phone: event.target.value }))} placeholder="+91..." />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Type</label>
                <Select value={quickAdd.type} onChange={(event) => setQuickAdd((prev) => ({ ...prev, type: event.target.value as QuickType }))}>
                  <option value="CUSTOMER">Customer</option>
                  <option value="LEAD">Lead</option>
                  <option value="VENDOR">Vendor</option>
                  <option value="PARTNER">Partner</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Source</label>
                <Select value={quickAdd.source} onChange={(event) => setQuickAdd((prev) => ({ ...prev, source: event.target.value as QuickSource }))}>
                  <option value="WALK_IN">Walk-in</option>
                  <option value="REFERRAL">Referral</option>
                  <option value="WEBSITE">Website</option>
                  <option value="SOCIAL_MEDIA">Social media</option>
                  <option value="COLD_CALL">Cold call</option>
                  <option value="EXHIBITION">Exhibition</option>
                  <option value="OTHER">Other</option>
                </Select>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                Full contact details can be filled later from the profile screen.
              </div>
            </div>
            <DialogFooter className="border-t bg-slate-50 px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setQuickAddOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleQuickAdd}>
                Save Contact
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogOverlay />
        <DialogContent className="w-[min(94vw,52rem)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Contacts from CSV</DialogTitle>
            <DialogDescription>
              This demo parses and previews the CSV only. Use the sample format below and map columns step by step.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border bg-muted/20 p-4 text-sm">
              <p className="font-medium">Expected columns</p>
              <p className="mt-1 text-muted-foreground">
                name, phone, type, source, email, company, assignedTo, tags, status, city, state, pincode, whatsapp, designation
              </p>
              <p className="mt-3 font-medium">Tag separator</p>
              <p className="text-muted-foreground">Use `|` for multiple tags in a single cell.</p>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <Badge variant={importStep === 1 ? 'default' : 'secondary'}>1. Paste</Badge>
              <Badge variant={importStep === 2 ? 'default' : 'secondary'}>2. Map</Badge>
              <Badge variant={importStep === 3 ? 'default' : 'secondary'}>3. Preview</Badge>
            </div>

            {importStep === 1 ? (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium">CSV content</label>
                  <textarea
                    value={csvText}
                    onChange={(event) => setCsvText(event.target.value)}
                    rows={10}
                    className="flex min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="button" onClick={submitImportPreview}>
                    Parse CSV
                  </Button>
                </div>
              </div>
            ) : null}

            {importStep >= 2 ? (
              <div className="space-y-4">
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="mb-2 text-sm font-medium">Detected headers</p>
                  <div className="flex flex-wrap gap-2">
                    {parsedCsv.headers.map((header) => (
                      <Badge key={header} variant="secondary">
                        {header}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {IMPORT_FIELDS.map((field) => (
                    <div key={field.key} className="space-y-1">
                      <label className="block text-sm font-medium">
                        {field.label} {field.required ? <span className="text-red-500">*</span> : null}
                      </label>
                      <Select value={fieldMap[field.key] || ''} onChange={(event) => setFieldMap((prev) => ({ ...prev, [field.key]: event.target.value }))}>
                        <option value="">Not mapped</option>
                        {parsedCsv.headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {importStep === 3 ? (
              <div className="space-y-3">
                <p className="text-sm font-medium">Preview rows</p>
                <div className="space-y-2">
                  {importPreview.map((row, index) => (
                    <div key={`${row.displayName}-${index}`} className="rounded-xl border bg-muted/20 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="font-medium">{row.displayName || 'Unnamed contact'}</p>
                        <Badge variant="secondary">{row.type}</Badge>
                      </div>
                      <p className="mt-2 text-muted-foreground">
                        {row.phone || 'No phone'} · {row.email || 'No email'} · {row.source || 'No source'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Assigned to {row.assignedTo || 'N/A'} · Tags: {row.tags || 'none'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              Close
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setImportStep(1)
                setCsvText(SAMPLE_CSV)
                setParsedCsv(parseCsv(SAMPLE_CSV))
              }}
            >
              Reset sample
            </Button>
            {importStep === 2 ? (
              <Button type="button" onClick={() => setImportStep(3)}>
                Preview Import
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function PhoneShortcut() {
  return <span className="inline-flex items-center gap-2"><PhoneCall className="h-4 w-4" /><span>Call log</span></span>
}

function NoteShortcut() {
  return <span className="inline-flex items-center gap-2"><Sheet className="h-4 w-4" /><span>Add note</span></span>
}
