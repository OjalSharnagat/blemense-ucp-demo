import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Eye,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Send
} from 'lucide-react'
import { useCRMStore } from '@/lib/crmStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
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
import type { Activity, Campaign, CampaignContactResult, CampaignResponseStatus, CampaignType, Contact, Segment } from '@/data/crm'
import {
  crmDate,
  getContactAvatarClass,
  getContactDisplayName,
  getContactInitials,
  panelClassName
} from './shared'

type CampaignDraft = {
  name: string
  type: CampaignType
  segmentId: string
  message: string
  startDate: string
  endDate: string
  notes: string
}

type ActivityDraft = {
  contactId: string
  type: Activity['type']
  subject: string
  description: string
  outcome: string
  scheduledAt: string
}

type CampaignRow = {
  contact: Contact
  result: CampaignContactResult
}

const RESPONSE_OPTIONS: Array<{ value: CampaignResponseStatus; label: string }> = [
  { value: 'NO_RESPONSE', label: 'No Response' },
  { value: 'INTERESTED', label: 'Interested' },
  { value: 'NOT_INTERESTED', label: 'Not Interested' },
  { value: 'CONVERTED', label: 'Converted' }
]

const CAMPAIGN_TYPE_OPTIONS: Array<{ value: CampaignType; label: string }> = [
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'CALL', label: 'Call' },
  { value: 'SMS', label: 'SMS' }
]

function buildDraft(segmentId = ''): CampaignDraft {
  return {
    name: '',
    type: 'WHATSAPP',
    segmentId,
    message: '',
    startDate: '',
    endDate: '',
    notes: ''
  }
}

function buildActivityDraft(contactId = '', type: Activity['type'] = 'FOLLOW_UP', subject = ''): ActivityDraft {
  return {
    contactId,
    type,
    subject,
    description: '',
    outcome: '',
    scheduledAt: ''
  }
}

function campaignTypeIcon(type: CampaignType) {
  switch (type) {
    case 'EMAIL':
      return Mail
    case 'CALL':
      return Phone
    case 'SMS':
      return Send
    case 'WHATSAPP':
    default:
      return MessageCircle
  }
}

function activityTypeForCampaign(type: CampaignType): Activity['type'] {
  switch (type) {
    case 'EMAIL':
      return 'EMAIL'
    case 'CALL':
      return 'CALL'
    case 'SMS':
      return 'FOLLOW_UP'
    case 'WHATSAPP':
    default:
      return 'WHATSAPP'
  }
}

function targetContactIdsForSegment(
  segment: Segment | undefined,
  contacts: Contact[],
  evaluateDynamicSegment: (segmentId: string) => string[]
): string[] {
  if (!segment) return []
  return segment.type === 'DYNAMIC' ? evaluateDynamicSegment(segment.id) : segment.contactIds.filter((id) => contacts.some((contact) => contact.id === id))
}

function buildRows(
  campaign: Campaign,
  segment: Segment | undefined,
  contacts: Contact[],
  evaluateDynamicSegment: (segmentId: string) => string[]
): CampaignRow[] {
  const targetIds = targetContactIdsForSegment(segment, contacts, evaluateDynamicSegment)
  const resultMap = new Map((campaign.contactResults || []).map((result) => [result.contactId, result]))

  return targetIds
    .map((contactId) => contacts.find((contact) => contact.id === contactId))
    .filter((contact): contact is Contact => Boolean(contact))
    .map((contact) => ({
      contact,
      result:
        resultMap.get(contact.id) ||
        ({
          contactId: contact.id,
          contacted: false,
          response: 'NO_RESPONSE',
          notes: ''
        } satisfies CampaignContactResult)
    }))
}

function updateCampaignResults(
  campaign: Campaign,
  segment: Segment | undefined,
  contacts: Contact[],
  nextRows: CampaignRow[],
  evaluateDynamicSegment: (segmentId: string) => string[]
): Campaign {
  const contactResults = nextRows.map(({ contact, result }) => ({
    ...result,
    contactId: contact.id,
    updatedAt: new Date().toISOString()
  }))
  return {
    ...campaign,
    contactCount: targetContactIdsForSegment(segment, contacts, evaluateDynamicSegment).length,
    respondedCount: contactResults.filter((result) => result.response !== 'NO_RESPONSE').length,
    convertedCount: contactResults.filter((result) => result.response === 'CONVERTED').length,
    contactResults
  }
}

export default function CampaignsView() {
  const navigate = useNavigate()
  const { id: campaignId } = useParams()
  const [searchParams] = useSearchParams()
  const { campaigns, segments, contacts, createCampaign, updateCampaign, logActivity, evaluateDynamicSegment, settings } = useCRMStore()

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [campaignDraft, setCampaignDraft] = useState<CampaignDraft>(() => buildDraft(searchParams.get('segment') || ''))
  const [activityDraft, setActivityDraft] = useState<ActivityDraft>(() => buildActivityDraft())
  const [prefillHandled, setPrefillHandled] = useState(false)
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(campaignId || null)
  const [selectedContactId, setSelectedContactId] = useState<string>('')

  const segmentParam = searchParams.get('segment') || ''
  const campaign = selectedCampaignId ? campaigns.find((item) => item.id === selectedCampaignId) ?? null : null
  const segment = useMemo(() => segments.find((item) => item.id === (campaign?.segmentId || campaignDraft.segmentId || segmentParam)), [campaign?.segmentId, campaignDraft.segmentId, segmentParam, segments])

  useEffect(() => {
    setSelectedCampaignId(campaignId || null)
  }, [campaignId])

  useEffect(() => {
    if (segmentParam && !campaignId && !prefillHandled) {
      setCampaignDraft((prev) => ({ ...prev, segmentId: segmentParam }))
      setCreateModalOpen(true)
      setPrefillHandled(true)
    }
  }, [campaignId, prefillHandled, segmentParam])

  const campaignList = useMemo(() => {
    return campaigns.map((entry) => {
      const entrySegment = segments.find((item) => item.id === entry.segmentId)
      const targetIds = targetContactIdsForSegment(entrySegment, contacts, evaluateDynamicSegment)
      return {
        ...entry,
        segment: entrySegment,
        targetCount: targetIds.length,
        contactedCount: (entry.contactResults || []).filter((result) => result.contacted).length,
        respondedCount: (entry.contactResults || []).filter((result) => result.response !== 'NO_RESPONSE').length,
        convertedCount: (entry.contactResults || []).filter((result) => result.response === 'CONVERTED').length
      }
    })
  }, [campaigns, contacts, segments])

  const summary = useMemo(() => {
    const active = campaigns.filter((campaign) => campaign.status === 'ACTIVE').length
    const completed = campaigns.filter((campaign) => campaign.status === 'COMPLETED').length
    const touched = campaigns.reduce((sum, campaign) => sum + campaign.contactCount, 0)
    return { active, completed, touched }
  }, [campaigns])

  const selectedCampaign = campaign
  const selectedSegment = selectedCampaign ? segments.find((item) => item.id === selectedCampaign.segmentId) : null
  const selectedRows = selectedCampaign ? buildRows(selectedCampaign, selectedSegment, contacts, evaluateDynamicSegment) : []

  if (!settings.enableCampaigns) {
    return (
      <div className="dash-view space-y-6">
        <Card className={panelClassName()}>
          <CardContent className="space-y-4 p-6">
            <Badge variant="secondary">Campaigns disabled</Badge>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">Manual outreach tracking is off</h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                This business is currently using the contacts-and-activities CRM mode. Enable Campaigns in CRM Settings when you want to track
                manual WhatsApp, email, call, or SMS outreach at scale.
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

  const stats = useMemo(() => {
    if (!selectedCampaign) return null
    const targetIds = targetContactIdsForSegment(selectedSegment, contacts, evaluateDynamicSegment)
    const contactResults = selectedCampaign.contactResults || []
    return {
      targeted: targetIds.length,
      contacted: contactResults.filter((result) => result.contacted).length,
      responded: contactResults.filter((result) => result.response !== 'NO_RESPONSE').length,
      converted: contactResults.filter((result) => result.response === 'CONVERTED').length
    }
  }, [contacts, selectedCampaign, selectedSegment])

  const openCreateCampaign = () => {
    setCampaignDraft(buildDraft(segmentParam))
    setCreateModalOpen(true)
  }

  const saveCampaign = () => {
    if (!campaignDraft.name.trim()) return

    const targetSegment = segments.find((item) => item.id === campaignDraft.segmentId)
    const targetIds = targetContactIdsForSegment(targetSegment, contacts, evaluateDynamicSegment)
    const contactResults = targetIds.map((contactId) => ({
      contactId,
      contacted: false,
      response: 'NO_RESPONSE' as CampaignResponseStatus,
      notes: '',
      updatedAt: new Date().toISOString()
    }))

    createCampaign({
      name: campaignDraft.name.trim(),
      type: campaignDraft.type,
      segmentId: campaignDraft.segmentId || undefined,
      status: 'DRAFT',
      startDate: campaignDraft.startDate || undefined,
      endDate: campaignDraft.endDate || undefined,
      message: campaignDraft.message.trim(),
      contactCount: targetIds.length,
      respondedCount: 0,
      convertedCount: 0,
      notes: campaignDraft.notes.trim() || undefined,
      contactResults
    })

    setCreateModalOpen(false)
    setCampaignDraft(buildDraft())
    navigate('/admin/crm/campaigns')
  }

  const upsertRow = (campaignId: string, nextRow: CampaignRow) => {
    const currentCampaign = campaigns.find((item) => item.id === campaignId)
    if (!currentCampaign) return
    const currentSegment = segments.find((item) => item.id === currentCampaign.segmentId)
    const currentRows = buildRows(currentCampaign, currentSegment, contacts, evaluateDynamicSegment)
    const nextRows = currentRows.map((row) => (row.contact.id === nextRow.contact.id ? nextRow : row))
    updateCampaign({
      ...updateCampaignResults(currentCampaign, currentSegment, contacts, nextRows, evaluateDynamicSegment),
      updatedAt: new Date().toISOString()
    })
  }

  const openActivityModal = (contactId: string) => {
    if (!selectedCampaign) return
    const contact = contacts.find((item) => item.id === contactId)
    const activityType = activityTypeForCampaign(selectedCampaign.type)
    setSelectedContactId(contactId)
    setActivityDraft({
      contactId,
      type: activityType,
      subject: `${selectedCampaign.name}${contact ? ` · ${getContactDisplayName(contact)}` : ''}`,
      description: `Campaign: ${selectedCampaign.name}\n${selectedCampaign.message}`,
      outcome: '',
      scheduledAt: new Date().toISOString().slice(0, 16)
    })
    setActivityModalOpen(true)
  }

  const saveActivity = () => {
    if (!selectedCampaign || !selectedContactId) return
    const contact = contacts.find((item) => item.id === selectedContactId)
    if (!contact) return

    const completedAt = activityDraft.scheduledAt ? new Date(activityDraft.scheduledAt).toISOString() : new Date().toISOString()
    logActivity({
      type: activityDraft.type,
      contactId: contact.id,
      subject: activityDraft.subject.trim() || `${selectedCampaign.name} outreach`,
      description: activityDraft.description.trim() || `Campaign outreach for ${selectedCampaign.name}.`,
      outcome: activityDraft.outcome.trim() || `${selectedCampaign.name} logged manually`,
      completedAt,
      status: 'COMPLETED',
      createdBy: 'Team',
      attachments: []
    })

    const currentRows = buildRows(selectedCampaign, selectedSegment, contacts, evaluateDynamicSegment)
    const nextRows = currentRows.map((row) =>
      row.contact.id === contact.id
        ? {
            ...row,
            result: {
              ...row.result,
              contacted: true,
              contactedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }
        : row
    )
    updateCampaign({
      ...updateCampaignResults(selectedCampaign, selectedSegment, contacts, nextRows, evaluateDynamicSegment),
      updatedAt: new Date().toISOString()
    })

    setActivityModalOpen(false)
    setSelectedContactId('')
  }

  if (campaignId && !selectedCampaign) {
    return <Navigate to="/admin/crm/campaigns" replace />
  }

  return (
    <div className="dash-view space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground">Track manual WhatsApp, call, email, and SMS outreach without pretending it is a bulk sender.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/crm/segments">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Segments
            </Link>
          </Button>
          <Button type="button" onClick={openCreateCampaign}>
            <Plus className="mr-2 h-4 w-4" />
            Create Campaign
          </Button>
        </div>
      </div>

      {!selectedCampaign ? (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Card className={panelClassName()}>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Active</p>
                <p className="mt-2 text-2xl font-semibold">{summary.active.toLocaleString('en-IN')}</p>
              </CardContent>
            </Card>
            <Card className={panelClassName()}>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed</p>
                <p className="mt-2 text-2xl font-semibold">{summary.completed.toLocaleString('en-IN')}</p>
              </CardContent>
            </Card>
            <Card className={panelClassName()}>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Contacts touched</p>
                <p className="mt-2 text-2xl font-semibold">{summary.touched.toLocaleString('en-IN')}</p>
              </CardContent>
            </Card>
          </div>

          <Card className={panelClassName()}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Campaign list</CardTitle>
              <CardDescription>Each campaign is a manual outreach run with a target segment and recorded results.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Segment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead className="text-right">Contact Count</TableHead>
                    <TableHead className="text-right">Responded</TableHead>
                    <TableHead className="text-right">Converted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignList.map((campaign) => {
                    const Icon = campaignTypeIcon(campaign.type)
                    return (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">
                          <button
                            type="button"
                            className="text-left hover:text-primary"
                            onClick={() => navigate(`/admin/crm/campaigns/${campaign.id}`)}
                          >
                            {campaign.name}
                          </button>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="gap-1">
                            <Icon className="h-3.5 w-3.5" />
                            {campaign.type}
                          </Badge>
                        </TableCell>
                        <TableCell>{campaign.segment?.name || 'No segment selected'}</TableCell>
                        <TableCell>
                          <Badge variant={campaign.status === 'ACTIVE' ? 'default' : campaign.status === 'COMPLETED' ? 'success' : 'secondary'}>
                            {campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{campaign.startDate ? crmDate.format(new Date(campaign.startDate)) : 'No start'}</TableCell>
                        <TableCell className="text-right">{campaign.targetCount.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right">{campaign.respondedCount.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right">{campaign.convertedCount.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-right">
                          <Button type="button" size="sm" variant="ghost" onClick={() => navigate(`/admin/crm/campaigns/${campaign.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {!campaignList.length ? (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No campaigns yet.</div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="space-y-6">
          <Card className={panelClassName('overflow-hidden')}>
            <div className="grid gap-6 bg-[linear-gradient(135deg,rgba(15,23,42,0.96)_0%,rgba(30,64,175,0.92)_55%,rgba(37,99,235,0.82)_100%)] p-6 text-white lg:grid-cols-[1.4fr_0.8fr]">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-white/20 bg-white/10 text-white">{selectedCampaign.type}</Badge>
                  <Badge className="border-white/20 bg-white/10 text-white">{selectedCampaign.status}</Badge>
                  <Badge className="border-white/20 bg-white/10 text-white">{selectedSegment?.name || 'No segment'}</Badge>
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight">{selectedCampaign.name}</h2>
                  <p className="max-w-2xl text-sm leading-6 text-white/80">
                    {selectedCampaign.message}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild className="bg-white text-slate-900 hover:bg-white/90">
                    <Link to="/admin/crm/campaigns">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to list
                    </Link>
                  </Button>
                  <Button type="button" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10" onClick={openCreateCampaign}>
                    <Plus className="mr-2 h-4 w-4" />
                    New campaign
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Targeted</p>
                  <p className="mt-2 text-2xl font-semibold">{stats?.targeted.toLocaleString('en-IN')}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Contacted</p>
                  <p className="mt-2 text-2xl font-semibold">{stats?.contacted.toLocaleString('en-IN')}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Responded</p>
                  <p className="mt-2 text-2xl font-semibold">{stats?.responded.toLocaleString('en-IN')}</p>
                </article>
                <article className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                  <p className="text-xs uppercase tracking-[0.2em] text-white/60">Converted</p>
                  <p className="mt-2 text-2xl font-semibold">{stats?.converted.toLocaleString('en-IN')}</p>
                </article>
              </div>
            </div>
          </Card>

          <Card className={panelClassName()}>
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg">Target contacts</CardTitle>
                  <CardDescription>Check off who you contacted, record the response, and keep outreach notes tidy.</CardDescription>
                </div>
                <Badge variant="secondary">{selectedRows.length.toLocaleString('en-IN')} contacts</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contacted</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRows.map(({ contact, result }) => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={cn('flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold', getContactAvatarClass(contact.displayName))}>
                            {getContactInitials(getContactDisplayName(contact))}
                          </div>
                          <div>
                            <p className="font-medium">{getContactDisplayName(contact)}</p>
                            <p className="text-xs text-muted-foreground">{contact.company || contact.city || 'No company linked'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={result.contacted}
                          onChange={(event) =>
                            upsertRow(selectedCampaign.id, {
                              contact,
                              result: {
                                ...result,
                                contacted: event.target.checked,
                                contactedAt: event.target.checked ? new Date().toISOString() : result.contactedAt,
                                updatedAt: new Date().toISOString()
                              }
                            })
                          }
                          className="h-4 w-4 rounded border-input"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          value={result.response}
                          onChange={(event) =>
                            upsertRow(selectedCampaign.id, {
                              contact,
                              result: {
                                ...result,
                                response: event.target.value as CampaignResponseStatus,
                                contacted: event.target.value !== 'NO_RESPONSE' ? true : result.contacted,
                                contactedAt: event.target.value !== 'NO_RESPONSE' ? new Date().toISOString() : result.contactedAt,
                                updatedAt: new Date().toISOString()
                              }
                            })
                          }
                        >
                          {RESPONSE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          value={result.notes || ''}
                          onChange={(event) =>
                            upsertRow(selectedCampaign.id, {
                              contact,
                              result: {
                                ...result,
                                notes: event.target.value,
                                updatedAt: new Date().toISOString()
                              }
                            })
                          }
                          placeholder="Call outcome, objections, next step"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" size="sm" variant="ghost" onClick={() => openActivityModal(contact.id)}>
                          <Send className="mr-2 h-4 w-4" />
                          Log Activity
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!selectedRows.length ? (
                    <TableRow>
                      <TableCell colSpan={5}>
                        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No contacts found for this segment.</div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogOverlay className="bg-slate-950/70 backdrop-blur-md" />
        <DialogContent className="w-[min(96vw,54rem)] max-h-[90vh] overflow-y-auto border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>
              Record the outreach you ran manually so the team can see who was targeted and what happened.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Name</label>
              <Input value={campaignDraft.name} onChange={(event) => setCampaignDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="Festival Reconnect" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <Select value={campaignDraft.type} onChange={(event) => setCampaignDraft((prev) => ({ ...prev, type: event.target.value as CampaignType }))}>
                {CAMPAIGN_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Target Segment</label>
              <Select value={campaignDraft.segmentId} onChange={(event) => setCampaignDraft((prev) => ({ ...prev, segmentId: event.target.value }))}>
                <option value="">Select a segment</option>
                {segments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Message Template</label>
              <textarea
                value={campaignDraft.message}
                onChange={(event) => setCampaignDraft((prev) => ({ ...prev, message: event.target.value }))}
                rows={4}
                className="min-h-28 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Paste the WhatsApp message or call script you used manually."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Start Date</label>
              <Input type="date" value={campaignDraft.startDate} onChange={(event) => setCampaignDraft((prev) => ({ ...prev, startDate: event.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">End Date</label>
              <Input type="date" value={campaignDraft.endDate} onChange={(event) => setCampaignDraft((prev) => ({ ...prev, endDate: event.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea
                value={campaignDraft.notes}
                onChange={(event) => setCampaignDraft((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
                className="min-h-24 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Why this campaign matters, special context, follow-up instructions."
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveCampaign} disabled={!campaignDraft.name.trim() || !campaignDraft.segmentId}>
              Create campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={activityModalOpen} onOpenChange={setActivityModalOpen}>
        <DialogOverlay className="bg-slate-950/70 backdrop-blur-md" />
        <DialogContent className="w-[min(96vw,46rem)] max-h-[90vh] overflow-y-auto border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5">
          <DialogHeader>
            <DialogTitle>Log Activity</DialogTitle>
            <DialogDescription>Pre-filled with the campaign and contact context so manual outreach stays fast.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Type</label>
              <Select value={activityDraft.type} onChange={(event) => setActivityDraft((prev) => ({ ...prev, type: event.target.value as Activity['type'] }))}>
                <option value="CALL">Call</option>
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="FOLLOW_UP">Follow up</option>
                <option value="NOTE">Note</option>
                <option value="TASK">Task</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Date and time</label>
              <Input
                type="datetime-local"
                value={activityDraft.scheduledAt}
                onChange={(event) => setActivityDraft((prev) => ({ ...prev, scheduledAt: event.target.value }))}
              />
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
                className="min-h-24 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Outcome</label>
              <Input value={activityDraft.outcome} onChange={(event) => setActivityDraft((prev) => ({ ...prev, outcome: event.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActivityModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveActivity} disabled={!selectedContactId}>
              Save activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
