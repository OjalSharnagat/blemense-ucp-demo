import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  CheckCircle2,
  Eye,
  Plus,
  RotateCcw,
} from 'lucide-react'
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
import { cn } from '@/lib/utils'
import type { Activity } from '@/data/crm'
import {
  ActivityDueBanner,
  activityTypeBg,
  activityTypeLabel,
  activityTypeTone,
  describeActivity,
  formatActivityTime,
  getActivityIcon,
  getContactAvatarClass,
  getContactDisplayName,
  getContactInitials,
  getDealTerminology,
  isActivityOverdue,
  panelClassName,
  ratingVariant,
  statusVariant
} from './shared'

type ActivityTab = 'UPCOMING' | 'COMPLETED' | 'ALL'
type ViewMode = 'LIST' | 'CALENDAR'
type ActivityFormState = {
  type: Activity['type']
  contactId: string
  dealId: string
  subject: string
  description: string
  outcome: string
  dateTime: string
  duration: string
  status: Activity['status']
  reminderEnabled: boolean
  reminder: string
}

const ACTIVITY_TABS: Array<{ id: ActivityTab; label: string }> = [
  { id: 'UPCOMING', label: 'Upcoming' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'ALL', label: 'All' }
]

const TYPE_CHOICES: Array<Activity['type']> = ['CALL', 'EMAIL', 'WHATSAPP', 'MEETING', 'SITE_VISIT', 'NOTE', 'TASK']
const CALENDAR_HOURS = [8, 10, 12, 14, 16, 18, 20]

function startOfWeek(date = new Date()): Date {
  const next = new Date(date)
  const day = next.getDay()
  const diff = day === 0 ? -6 : 1 - day
  next.setDate(next.getDate() + diff)
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function formatClock(date: Date): string {
  return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
}

function formatCalendarDay(date: Date): string {
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })
}

function buildDraft(activity?: Activity): ActivityFormState {
  const dateTime = activity?.scheduledAt || activity?.completedAt || ''
  return {
    type: activity?.type || 'CALL',
    contactId: activity?.contactId || '',
    dealId: activity?.dealId || '',
    subject: activity?.subject || '',
    description: activity?.description || '',
    outcome: activity?.outcome || '',
    dateTime,
    duration: activity?.duration ? String(activity.duration) : '',
    status: activity?.status || 'SCHEDULED',
    reminderEnabled: Boolean(activity?.reminder),
    reminder: activity?.reminder ? String(activity.reminder) : '15'
  }
}

export default function ActivitiesView() {
  const { activities, contacts, deals, settings, getDueActivities, completeActivity, logActivity, updateActivity } = useCRMStore()
  const showTeamFeatures = settings.enableTeamFeatures
  const dealTerm = getDealTerminology(settings)
  const dueActivities = getDueActivities()

  const [activeTab, setActiveTab] = useState<ActivityTab>('UPCOMING')
  const [viewMode, setViewMode] = useState<ViewMode>('LIST')
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null)
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null)
  const [contactSearch, setContactSearch] = useState('')
  const [dealSearch, setDealSearch] = useState('')
  const [activityDraft, setActivityDraft] = useState<ActivityFormState>(() => buildDraft())

  const contactById = useMemo(() => new Map(contacts.map((contact) => [contact.id, contact])), [contacts])
  const dealById = useMemo(() => new Map(deals.map((deal) => [deal.id, deal])), [deals])
  const selectedActivity = selectedActivityId ? activities.find((activity) => activity.id === selectedActivityId) ?? null : null
  const editingActivity = editingActivityId ? activities.find((activity) => activity.id === editingActivityId) ?? null : null

  const upcomingActivities = useMemo(
    () =>
      [...activities]
        .filter((activity) => activity.status === 'SCHEDULED')
        .sort((a, b) => {
          const overdueA = isActivityOverdue(a)
          const overdueB = isActivityOverdue(b)
          if (overdueA !== overdueB) return overdueA ? -1 : 1
          return new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime()
        }),
    [activities]
  )

  const completedActivities = useMemo(
    () =>
      [...activities]
        .filter((activity) => activity.status === 'COMPLETED')
        .sort((a, b) => new Date(b.completedAt || b.scheduledAt || 0).getTime() - new Date(a.completedAt || a.scheduledAt || 0).getTime()),
    [activities]
  )

  const allActivities = useMemo(
    () =>
      [...activities].sort((a, b) => new Date(b.completedAt || b.scheduledAt || 0).getTime() - new Date(a.completedAt || a.scheduledAt || 0).getTime()),
    [activities]
  )

  const visibleActivities = activeTab === 'UPCOMING' ? upcomingActivities : activeTab === 'COMPLETED' ? completedActivities : allActivities

  const summary = useMemo(() => {
    const scheduled = activities.filter((activity) => activity.status === 'SCHEDULED').length
    const completed = activities.filter((activity) => activity.status === 'COMPLETED').length
    const missed = activities.filter((activity) => activity.status === 'MISSED').length
    const overdue = dueActivities.filter(isActivityOverdue).length
    return { scheduled, completed, missed, overdue }
  }, [activities, dueActivities])

  const weekDays = useMemo(() => {
    const start = startOfWeek()
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }, [])

  const calendarEntries = useMemo(() => {
    const start = startOfWeek()
    const end = addDays(start, 7)
    return activities.filter((activity) => {
      if (activity.status !== 'SCHEDULED' || !activity.scheduledAt) return false
      const time = new Date(activity.scheduledAt)
      return time >= start && time < end
    })
  }, [activities])

  const contactMatches = useMemo(() => {
    const query = contactSearch.trim().toLowerCase()
    return contacts.filter((contact) => {
      if (!query) return true
      return [getContactDisplayName(contact), contact.company, contact.phone, contact.email]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [contactSearch, contacts])

  const dealMatches = useMemo(() => {
    const query = dealSearch.trim().toLowerCase()
    return deals.filter((deal) => {
      const contact = contactById.get(deal.contactId)
      if (activityDraft.contactId && deal.contactId !== activityDraft.contactId) return false
      if (!query) return true
      return [deal.title, contact?.displayName, contact?.company, deal.assignedTo, deal.source]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    })
  }, [activityDraft.contactId, contactById, dealSearch, deals])

  const openNewActivity = () => {
    setEditingActivityId(null)
    setContactSearch('')
    setDealSearch('')
    setActivityDraft(buildDraft())
    setActivityModalOpen(true)
  }

  const openReschedule = (activity: Activity) => {
    setEditingActivityId(activity.id)
    setContactSearch('')
    setDealSearch('')
    setActivityDraft(buildDraft(activity))
    setActivityModalOpen(true)
  }

  const openActivityDetails = (activityId: string) => {
    setSelectedActivityId(activityId)
  }

  const closeActivityDetails = () => {
    setSelectedActivityId(null)
  }

  const handleSaveActivity = () => {
    if (!activityDraft.contactId || !activityDraft.subject.trim()) return

    const now = new Date().toISOString()
    const isCompleted = activityDraft.status === 'COMPLETED'
    const payload: Activity = {
      id: editingActivity?.id || `crm-act-${Date.now().toString(36)}`,
      type: activityDraft.type,
      contactId: activityDraft.contactId,
      dealId: activityDraft.dealId || undefined,
      subject: activityDraft.subject.trim(),
      description: activityDraft.description.trim() || undefined,
      outcome: isCompleted ? activityDraft.outcome.trim() || undefined : undefined,
      scheduledAt: !isCompleted ? activityDraft.dateTime || undefined : undefined,
      completedAt: isCompleted ? activityDraft.dateTime || now : undefined,
      duration: activityDraft.duration.trim() ? Number(activityDraft.duration) : undefined,
      status: activityDraft.status,
      createdBy: editingActivity?.createdBy || settings.defaultAssignee,
      reminder: activityDraft.reminderEnabled && activityDraft.reminder.trim() ? Number(activityDraft.reminder) : undefined,
      attachments: editingActivity?.attachments || []
    }

    if (editingActivity) {
      updateActivity(payload)
    } else {
      logActivity(payload)
    }

    setActivityModalOpen(false)
    setEditingActivityId(null)
  }

  const renderRow = (activity: Activity) => {
    const contact = contactById.get(activity.contactId)
    const deal = activity.dealId ? dealById.get(activity.dealId) : undefined
    const activityIcon = getActivityIcon(activity.type)
    const Icon = activityIcon
    const assignedTo = activity.createdBy || contact?.assignedTo || settings.defaultAssignee
    const overdue = isActivityOverdue(activity)

    return (
      <div
        key={activity.id}
        className={cn(
          'grid gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-colors lg:grid-cols-[1.2fr_1.5fr_1fr_0.9fr_auto]',
          overdue ? 'border-rose-200 bg-rose-50/50' : 'border-border/80'
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border', activityTypeBg[activity.type])}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={overdue ? 'destructive' : activity.status === 'COMPLETED' ? 'success' : 'warning'}>
                {overdue ? 'Overdue' : activityTypeLabel[activity.type]}
              </Badge>
              {deal ? <Badge variant="secondary">{deal.title}</Badge> : null}
            </div>
            <Link
              to={contact ? `/admin/crm/contacts/${contact.id}` : '#'}
              className="block truncate text-sm font-semibold text-foreground hover:text-primary"
            >
              {contact ? getContactDisplayName(contact) : activity.contactId}
            </Link>
            <p className="truncate text-sm text-muted-foreground">{contact?.company || contact?.designation || 'No company linked'}</p>
          </div>
        </div>

        <button
          type="button"
          className="min-w-0 text-left"
          onClick={() => openActivityDetails(activity.id)}
          title="View details"
        >
          <p className="truncate font-medium">{activity.subject}</p>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            {activity.description || activity.outcome || describeActivity(activity, contact ? getContactDisplayName(contact) : activity.contactId)}
          </p>
        </button>

        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">{activity.status === 'COMPLETED' ? 'Completed' : 'Scheduled'}</p>
          <p className={cn('font-medium', overdue ? 'text-rose-600' : 'text-foreground')}>
            {formatActivityTime(activity)}
          </p>
          {activity.duration ? <p className="text-muted-foreground">{activity.duration} min</p> : null}
        </div>

        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">Assigned to</p>
          <div className="flex items-center gap-2">
            <div className={cn('flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold', getContactAvatarClass(assignedTo))}>
              {getContactInitials(assignedTo)}
            </div>
            <p className="min-w-0 truncate font-medium">{assignedTo}</p>
          </div>
          {contact?.status ? <Badge variant={statusVariant(contact.status)}>{contact.status}</Badge> : null}
          {contact?.rating ? <Badge variant={ratingVariant(contact.rating)}>{contact.rating}</Badge> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 lg:flex-col lg:items-stretch lg:justify-start">
          {activity.status === 'SCHEDULED' ? (
            <>
              <Button size="sm" variant="default" onClick={() => completeActivity(activity.id, 'Completed from activities workspace')}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete
              </Button>
              <Button size="sm" variant="outline" onClick={() => openReschedule(activity)}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reschedule
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => openActivityDetails(activity.id)}>
              <Eye className="mr-2 h-4 w-4" />
              View
            </Button>
          )}
        </div>
      </div>
    )
  }

  const renderCalendar = () => {
    const start = startOfWeek()
    const scheduledEntries = calendarEntries.map((activity) => {
      const scheduledAt = new Date(activity.scheduledAt!)
      const dayIndex = Math.floor((scheduledAt.getTime() - start.getTime()) / 86400000)
      const hour = scheduledAt.getHours()
      const slotIndex = CALENDAR_HOURS.findIndex((slotHour, index) => hour >= slotHour && hour < (CALENDAR_HOURS[index + 1] ?? 24))
      return { activity, dayIndex, slotIndex: slotIndex < 0 ? CALENDAR_HOURS.length - 1 : slotIndex }
    })

    return (
      <div className="overflow-x-auto">
        <div className="min-w-[58rem] space-y-3">
          <div className="grid grid-cols-[5rem_repeat(7,minmax(0,1fr))] gap-2">
            <div />
            {weekDays.map((day) => (
              <div key={day.toISOString()} className="rounded-2xl border border-border/70 bg-muted/40 px-3 py-2 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{day.toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                <p className="mt-1 text-sm font-semibold">{formatCalendarDay(day)}</p>
              </div>
            ))}
          </div>

          {CALENDAR_HOURS.map((hour, slotIndex) => (
            <div key={hour} className="grid grid-cols-[5rem_repeat(7,minmax(0,1fr))] gap-2">
              <div className="flex items-start justify-end px-2 pt-3 text-xs font-medium text-muted-foreground">
                {formatClock(new Date(new Date().setHours(hour, 0, 0, 0)))}
              </div>
              {weekDays.map((day, dayIndex) => {
                const cellActivities = scheduledEntries.filter((entry) => entry.dayIndex === dayIndex && entry.slotIndex === slotIndex).map((entry) => entry.activity)
                return (
                  <div key={`${day.toISOString()}-${hour}`} className="min-h-28 rounded-2xl border border-border/70 bg-background p-2">
                    <div className="space-y-2">
              {cellActivities.slice(0, 3).map((activity) => {
                const Icon = getActivityIcon(activity.type)
                const contact = contactById.get(activity.contactId)
                return (
                  <button
                    key={activity.id}
                            type="button"
                            onClick={() => openActivityDetails(activity.id)}
                            className={cn(
                              'w-full rounded-xl border px-3 py-2 text-left shadow-sm transition-transform hover:-translate-y-0.5',
                              activityTypeTone[activity.type]
                            )}
                          >
                            <div className="flex items-start gap-2">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{activity.subject}</p>
                            <p className="truncate text-xs opacity-80">{contact ? getContactDisplayName(contact) : activity.contactId}</p>
                          </div>
                        </div>
                      </button>
                        )
                      })}
                      {cellActivities.length > 3 ? <p className="text-xs text-muted-foreground">+ {cellActivities.length - 3} more</p> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="dash-view space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Activities</h1>
        <p className="text-sm text-muted-foreground">Calls, emails, meetings, reminders, and the daily follow-up work that keeps the CRM alive.</p>
      </div>

      <ActivityDueBanner activities={dueActivities} />

      <div className="grid gap-3 md:grid-cols-3">
        <Card className={panelClassName()}>
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Scheduled</p>
            <p className="mt-2 text-2xl font-semibold">{summary.scheduled.toLocaleString('en-IN')}</p>
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
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Overdue</p>
            <p className="mt-2 text-2xl font-semibold">{summary.overdue.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
      </div>

      <Card className={panelClassName()}>
        <CardHeader className="gap-4 pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg">Activity workspace</CardTitle>
              <CardDescription>Use tabs for the list view, or switch to calendar mode for a weekly schedule.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={openNewActivity}>
                <Plus className="mr-2 h-4 w-4" />
                Log Activity
              </Button>
              <Button type="button" variant={viewMode === 'LIST' ? 'default' : 'outline'} onClick={() => setViewMode('LIST')}>
                List
              </Button>
              <Button type="button" variant={viewMode === 'CALENDAR' ? 'default' : 'outline'} onClick={() => setViewMode('CALENDAR')}>
                <CalendarDays className="mr-2 h-4 w-4" />
                Calendar
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {ACTIVITY_TABS.map((tab) => {
              const count = tab.id === 'UPCOMING' ? upcomingActivities.length : tab.id === 'COMPLETED' ? completedActivities.length : allActivities.length
              return (
                <Button
                  key={tab.id}
                  type="button"
                  variant={activeTab === tab.id ? 'default' : 'outline'}
                  className="gap-2"
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', activeTab === tab.id ? 'bg-white/15 text-white' : 'bg-muted text-muted-foreground')}>
                    {count}
                  </span>
                </Button>
              )
            })}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {viewMode === 'CALENDAR' ? (
            <>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                <p>Weekly calendar shows scheduled activities only. Click any block to open details.</p>
                <Badge variant="secondary">{calendarEntries.length.toLocaleString('en-IN')} scheduled</Badge>
              </div>
              {calendarEntries.length ? (
                renderCalendar()
              ) : (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No scheduled activities in the current week.
                </div>
              )}
            </>
          ) : visibleActivities.length ? (
            <div className="space-y-3">
              {visibleActivities.map(renderRow)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">No activities match this tab yet.</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={activityModalOpen} onOpenChange={setActivityModalOpen}>
        <DialogOverlay className="bg-slate-950/70 backdrop-blur-md" />
        <DialogContent className="w-[min(94vw,56rem)] max-h-[90vh] overflow-y-auto border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5">
          <DialogHeader>
            <DialogTitle>{editingActivity ? 'Reschedule Activity' : 'Log Activity'}</DialogTitle>
            <DialogDescription>
              {editingActivity
                ? 'Update the schedule so the follow-up stays accurate.'
                : 'Capture the interaction so the next follow-up never gets lost.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-sm font-medium">Type</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {TYPE_CHOICES.map((type) => {
                  const Icon = getActivityIcon(type)
                  const active = activityDraft.type === type
                  return (
                    <Button
                      key={type}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      className="justify-start gap-2"
                      onClick={() => setActivityDraft((prev) => ({ ...prev, type }))}
                    >
                      <Icon className="h-4 w-4" />
                      {activityTypeLabel[type]}
                    </Button>
                  )
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Contact search</label>
                <Input
                  value={contactSearch}
                  onChange={(event) => setContactSearch(event.target.value)}
                  placeholder="Search by name, company, phone, or email"
                />
                <label className="block text-sm font-medium">Contact</label>
                <Select value={activityDraft.contactId} onChange={(event) => setActivityDraft((prev) => ({ ...prev, contactId: event.target.value, dealId: '' }))}>
                  <option value="">Select contact</option>
                  {contactMatches.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {getContactDisplayName(contact)}{contact.company ? ` · ${contact.company}` : ''}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">{dealTerm.singular} search</label>
                <Input
                  value={dealSearch}
                  onChange={(event) => setDealSearch(event.target.value)}
                  placeholder={`Optional: search by ${dealTerm.singular.toLowerCase()} title or company`}
                />
                <label className="block text-sm font-medium">{dealTerm.singular}</label>
                <Select value={activityDraft.dealId} onChange={(event) => setActivityDraft((prev) => ({ ...prev, dealId: event.target.value }))}>
                  <option value="">{`No ${dealTerm.singular.toLowerCase()} linked`}</option>
                  {dealMatches.map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.title}{contactById.get(deal.contactId)?.company ? ` · ${contactById.get(deal.contactId)?.company}` : ''}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Subject</label>
                <Input
                  value={activityDraft.subject}
                  onChange={(event) => setActivityDraft((prev) => ({ ...prev, subject: event.target.value }))}
                  placeholder="Follow up on quotation"
                />
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
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Date and time</label>
                <Input
                  type="datetime-local"
                  value={activityDraft.dateTime}
                  onChange={(event) => setActivityDraft((prev) => ({ ...prev, dateTime: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Duration</label>
                <Input
                  type="number"
                  min="0"
                  value={activityDraft.duration}
                  onChange={(event) => setActivityDraft((prev) => ({ ...prev, duration: event.target.value }))}
                  placeholder="30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="mb-1 block text-sm font-medium">Description</label>
              <textarea
                value={activityDraft.description}
                onChange={(event) => setActivityDraft((prev) => ({ ...prev, description: event.target.value }))}
                rows={4}
                className="min-h-28 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="What was discussed, promised, or observed?"
              />
            </div>

            {activityDraft.status === 'COMPLETED' ? (
              <div className="space-y-2">
                <label className="mb-1 block text-sm font-medium">Outcome</label>
                <textarea
                  value={activityDraft.outcome}
                  onChange={(event) => setActivityDraft((prev) => ({ ...prev, outcome: event.target.value }))}
                  rows={3}
                  className="min-h-24 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="What happened as a result?"
                />
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Reminder</label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={activityDraft.reminderEnabled}
                    onChange={(event) => setActivityDraft((prev) => ({ ...prev, reminderEnabled: event.target.checked }))}
                    className="h-4 w-4 rounded border-input"
                  />
                  Set a reminder before the activity
                </label>
              </div>
              {activityDraft.reminderEnabled ? (
                <div className="min-w-32">
                  <label className="mb-1 block text-sm font-medium">Minutes before</label>
                  <Input
                    type="number"
                    min="1"
                    value={activityDraft.reminder}
                    onChange={(event) => setActivityDraft((prev) => ({ ...prev, reminder: event.target.value }))}
                    placeholder="15"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setActivityModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveActivity} disabled={!activityDraft.contactId || !activityDraft.subject.trim()}>
              {editingActivity ? 'Save changes' : 'Save activity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedActivity)} onOpenChange={(open) => !open && closeActivityDetails()}>
        <DialogOverlay className="bg-slate-950/70 backdrop-blur-md" />
        <DialogContent className="w-[min(94vw,42rem)] max-h-[90vh] overflow-y-auto border border-slate-200 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5">
          {selectedActivity ? (
            <>
              <DialogHeader>
                <DialogTitle>{selectedActivity.subject}</DialogTitle>
                <DialogDescription>{activityTypeLabel[selectedActivity.type]} · {selectedActivity.status}</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {(() => {
                  const contact = contactById.get(selectedActivity.contactId)
                  return (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Contact</p>
                        <Link
                          to={`/admin/crm/contacts/${selectedActivity.contactId}`}
                          className="mt-2 block text-sm font-semibold hover:text-primary"
                        >
                          {contact ? getContactDisplayName(contact) : selectedActivity.contactId}
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">{contact?.company || 'No company linked'}</p>
                      </div>
                      <div className="rounded-2xl border bg-muted/20 p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Timing</p>
                        <p className="mt-2 text-sm font-semibold">{formatActivityTime(selectedActivity)}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{selectedActivity.duration ? `${selectedActivity.duration} min` : 'No duration set'}</p>
                      </div>
                    </div>
                  )
                })()}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{showTeamFeatures ? 'Assigned to' : 'Owner'}</p>
                    <p className="mt-2 text-sm font-semibold">{selectedActivity.createdBy || settings.defaultAssignee}</p>
                  </div>
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{dealTerm.singular}</p>
                    <p className="mt-2 text-sm font-semibold">
                      {selectedActivity.dealId ? dealById.get(selectedActivity.dealId)?.title || `Linked ${dealTerm.singular.toLowerCase()}` : `No ${dealTerm.singular.toLowerCase()} linked`}
                    </p>
                  </div>
                </div>

                {selectedActivity.description ? (
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Description</p>
                    <p className="mt-2 text-sm leading-6">{selectedActivity.description}</p>
                  </div>
                ) : null}

                {selectedActivity.outcome ? (
                  <div className="rounded-2xl border bg-muted/20 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Outcome</p>
                    <p className="mt-2 text-sm leading-6">{selectedActivity.outcome}</p>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {selectedActivity.status === 'SCHEDULED' ? (
                    <>
                      <Button type="button" onClick={() => completeActivity(selectedActivity.id, 'Completed from activity details')}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Mark complete
                      </Button>
                      <Button type="button" variant="outline" onClick={() => {
                        openReschedule(selectedActivity)
                        closeActivityDetails()
                      }}>
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reschedule
                      </Button>
                    </>
                  ) : null}
                  <Button asChild type="button" variant="outline">
                    <Link to={`/admin/crm/contacts/${selectedActivity.contactId}`}>
                      <Eye className="mr-2 h-4 w-4" />
                      Open contact
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
