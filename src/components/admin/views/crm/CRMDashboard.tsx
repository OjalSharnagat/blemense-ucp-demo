import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  CheckSquare,
  Clock3,
  Hash,
  Mail,
  MapPin,
  MessageSquare,
  MonitorPlay,
  PhoneCall,
  StickyNote,
  Target,
  TrendingUp,
  Users,
  type LucideIcon
} from 'lucide-react'
import { useAdminStore } from '@/lib/store'
import { useBillingStore } from '@/lib/billingStore'
import { useCRMStore } from '@/lib/crmStore'
import { getCRMCompatibilityConfig } from '@/lib/businessMode'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ActivityDueBanner, panelClassName, crmDate, crmMoney, getContactAvatarClass, getContactDisplayName, getContactInitials } from './shared'
import type { Activity, Contact } from '@/data/crm'

function startOfDay(date = new Date()): number {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next.getTime()
}

function daysSince(value?: string): number {
  if (!value) return Number.POSITIVE_INFINITY
  const time = new Date(value).getTime()
  if (Number.isNaN(time)) return Number.POSITIVE_INFINITY
  return Math.floor((Date.now() - time) / 86400000)
}

function activityTimestamp(activity: Activity): string {
  return activity.completedAt || activity.scheduledAt || new Date(0).toISOString()
}

function isOverdue(activity: Activity): boolean {
  return activity.status === 'SCHEDULED' && Boolean(activity.scheduledAt) && new Date(activity.scheduledAt!).getTime() < startOfDay()
}

function getActivityIcon(type: Activity['type']): LucideIcon {
  switch (type) {
    case 'CALL':
      return PhoneCall
    case 'EMAIL':
      return Mail
    case 'MEETING':
      return CalendarClock
    case 'WHATSAPP':
      return MessageSquare
    case 'DEMO':
      return MonitorPlay
    case 'SITE_VISIT':
      return MapPin
    case 'FOLLOW_UP':
      return Clock3
    case 'NOTE':
      return StickyNote
    case 'TASK':
    default:
      return CheckSquare
  }
}

function describeActivity(activity: Activity, contactName: string): string {
  const actor = activity.createdBy || 'Team'
  switch (activity.type) {
    case 'CALL':
      return `${actor} called ${contactName}`
    case 'EMAIL':
      return `${actor} emailed ${contactName}`
    case 'MEETING':
      return `${actor} met ${contactName}`
    case 'WHATSAPP':
      return `${actor} messaged ${contactName} on WhatsApp`
    case 'DEMO':
      return `${actor} ran a demo for ${contactName}`
    case 'SITE_VISIT':
      return `${actor} visited ${contactName}`
    case 'FOLLOW_UP':
      return `Follow-up planned for ${contactName}`
    case 'NOTE':
      return `Note added for ${contactName}`
    case 'TASK':
    default:
      return `Task added for ${contactName}`
  }
}

function formatActivityTime(activity: Activity): string {
  const timestamp = activityTimestamp(activity)
  return new Date(timestamp).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

function formatDateOnly(value?: string): string {
  if (!value) return 'N/A'
  return new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' })
}

export default function CRMDashboard() {
  const { contacts, deals, activities, getDueActivities, completeActivity, settings } = useCRMStore()
  const { customers, orders } = useAdminStore()
  const { businessProfile, invoices } = useBillingStore()
  const crmCompatibility = getCRMCompatibilityConfig(businessProfile)

  const dueActivities = getDueActivities()
  const now = Date.now()

  const dashboard = useMemo(() => {
    const activeLeads = contacts.filter((contact) => contact.type === 'LEAD' && contact.status === 'ACTIVE')
    const openDeals = deals.filter((deal) => !deal.stage.startsWith('CLOSED'))
    const pipelineValue = openDeals.reduce((sum, deal) => sum + deal.value, 0)
    const stageOrder = ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'] as const
    const stageSummary = stageOrder.map((stage) => {
      const stageDeals = deals.filter((deal) => deal.stage === stage)
      const value = stageDeals.reduce((sum, deal) => sum + deal.value, 0)
      return {
        stage,
        count: stageDeals.length,
        value
      }
    })

    const latestActivityByContact = new Map<string, string>()
    for (const activity of activities) {
      const timestamp = activityTimestamp(activity)
      const current = latestActivityByContact.get(activity.contactId)
      if (!current || new Date(timestamp).getTime() > new Date(current).getTime()) {
        latestActivityByContact.set(activity.contactId, timestamp)
      }
    }

    const hotLeads = contacts
      .filter((contact) => contact.rating === 'HOT')
      .filter((contact) => daysSince(latestActivityByContact.get(contact.id)) >= 7)
      .map((contact) => ({
        contact,
        lastActivityAt: latestActivityByContact.get(contact.id)
      }))
      .sort((a, b) => (daysSince(b.lastActivityAt) - daysSince(a.lastActivityAt)) || a.contact.displayName.localeCompare(b.contact.displayName))

    const invoiceSummary = new Map<string, { total: number; count: number; lastInvoiceAt?: string }>()
    for (const invoice of invoices) {
      if (!invoice.customerId) continue
      const current = invoiceSummary.get(invoice.customerId) ?? { total: 0, count: 0, lastInvoiceAt: undefined }
      current.total += invoice.taxBreakdown.grandTotal
      current.count += 1
      current.lastInvoiceAt = !current.lastInvoiceAt || new Date(invoice.issueDate).getTime() > new Date(current.lastInvoiceAt).getTime() ? invoice.issueDate : current.lastInvoiceAt
      invoiceSummary.set(invoice.customerId, current)
    }

    const topCustomers = customers
      .map((customer) => ({
        customer,
        billing: invoiceSummary.get(customer.id) ?? { total: 0, count: 0, lastInvoiceAt: undefined }
      }))
      .filter(({ billing }) => billing.total > 0)
      .sort((a, b) => b.billing.total - a.billing.total)
      .slice(0, 5)

    const churnRiskCustomers = customers
      .map((customer) => {
        const orderDates = (customer.orderIds || [])
          .map((orderId) => orders.find((order) => order.id === orderId)?.date)
          .filter((value): value is string => Boolean(value))
        const lastPurchaseAt = orderDates.sort().slice(-1)[0]
        const daysAway = daysSince(lastPurchaseAt)
        return {
          customer,
          daysAway,
          lastPurchaseAt
        }
      })
      .filter(({ customer, daysAway }) => customer.totalOrders >= 3 && daysAway >= 60 && daysAway !== Number.POSITIVE_INFINITY)
      .sort((a, b) => b.daysAway - a.daysAway)
      .slice(0, 5)

    const recentFeed = [...activities]
      .sort((a, b) => new Date(activityTimestamp(b)).getTime() - new Date(activityTimestamp(a)).getTime())
      .slice(0, 10)

    return {
      activeLeads,
      openDeals,
      pipelineValue,
      stageSummary,
      hotLeads,
      topCustomers,
      churnRiskCustomers,
      recentFeed
    }
  }, [activities, contacts, deals, invoices, orders, customers])

  const maxStageValue = Math.max(...dashboard.stageSummary.map((stage) => stage.value), 1)
  const simpleMode = !settings.enableSalesPipeline
  const recentContacts = useMemo(
    () =>
      [...contacts]
        .sort((a, b) => new Date(b.lastContactedAt || b.updatedAt || b.createdAt).getTime() - new Date(a.lastContactedAt || a.updatedAt || a.createdAt).getTime())
        .slice(0, 8),
    [contacts]
  )

  if (simpleMode) {
    return (
      <div className="dash-view space-y-6">
        <ActivityDueBanner activities={dueActivities} />

        <div className={panelClassName('overflow-hidden')}>
          <div className="grid gap-6 bg-[linear-gradient(135deg,rgba(15,23,42,0.96)_0%,rgba(30,64,175,0.92)_55%,rgba(37,99,235,0.82)_100%)] p-6 text-white lg:grid-cols-[1.35fr_0.95fr]">
            <div className="space-y-4">
              <Badge className="w-fit border-white/20 bg-white/10 text-white">CRM home</Badge>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight">Contacts and follow-ups, first.</h1>
                <p className="max-w-2xl text-sm leading-6 text-white/78">
                  This CRM is running in a lightweight mode for small teams. Keep the contact list clean, finish today&apos;s tasks, and enable the sales pipeline when you&apos;re ready for deals or projects.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-white text-slate-900 hover:bg-white/90">
                  <Link to="/admin/crm/contacts/new">
                    New Contact
                    <Users className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                  <Link to="/admin/crm/settings">Enable Sales Pipeline</Link>
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <article className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Total contacts</p>
                <p className="mt-2 text-2xl font-semibold">{contacts.length.toLocaleString('en-IN')}</p>
              </article>
              <article className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.2em] text-white/60">Tasks due today</p>
                <p className="mt-2 text-2xl font-semibold">{dueActivities.length.toLocaleString('en-IN')}</p>
              </article>
            </div>
          </div>
        </div>

        {crmCompatibility.highlightReports || crmCompatibility.highlightSegments ? (
          <Card className={panelClassName()}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Recommended next steps</CardTitle>
              <CardDescription>Helpful when you have product catalog and repeat-buying customers.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {crmCompatibility.highlightReports ? (
                <Link to="/admin/crm/reports" className="rounded-2xl border bg-muted/20 p-4 transition hover:border-primary/40 hover:bg-muted/30">
                  <p className="font-medium">Customer Value Reports</p>
                  <p className="mt-1 text-sm text-muted-foreground">See who spends the most and who may be churning.</p>
                </Link>
              ) : null}
              {crmCompatibility.highlightSegments ? (
                <Link to="/admin/crm/segments" className="rounded-2xl border bg-muted/20 p-4 transition hover:border-primary/40 hover:bg-muted/30">
                  <p className="font-medium">Segment-based outreach</p>
                  <p className="mt-1 text-sm text-muted-foreground">Group customers by value, recency, or city for manual campaigns.</p>
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <Card className={panelClassName()}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Contacts</CardTitle>
              <CardDescription>The most recent records are shown first.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <div className="space-y-2">
                {recentContacts.map((contact) => (
                  <Link
                    key={contact.id}
                    to={`/admin/crm/contacts/${contact.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border bg-muted/20 px-4 py-3 transition hover:border-primary/40 hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{getContactDisplayName(contact)}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {contact.company || contact.phone || contact.email || 'No extra details'}
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{contact.type}</p>
                      <p>{contact.lastContactedAt ? crmDate.format(new Date(contact.lastContactedAt)) : 'Not contacted yet'}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className={panelClassName()}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Today&apos;s tasks</CardTitle>
              <CardDescription>Finish these before the day gets busy.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {dueActivities.length ? (
                dueActivities.slice(0, 8).map((activity) => {
                  const contact = contacts.find((item) => item.id === activity.contactId)
                  return (
                    <div key={activity.id} className="rounded-2xl border bg-muted/20 p-4">
                      <p className="font-medium">{activity.subject}</p>
                      <p className="text-sm text-muted-foreground">{contact ? getContactDisplayName(contact) : activity.contactId}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{formatActivityTime(activity)}</p>
                    </div>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No due activities today.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="dash-view space-y-6">
      <ActivityDueBanner activities={dueActivities} />

      <div className={panelClassName('overflow-hidden')}>
        <div className="grid gap-6 bg-[linear-gradient(135deg,rgba(15,23,42,0.96)_0%,rgba(30,64,175,0.92)_55%,rgba(37,99,235,0.82)_100%)] p-6 text-white lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-4">
            <Badge className="w-fit border-white/20 bg-white/10 text-white">CRM home</Badge>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight">One daily screen for follow-ups, pipeline health, and customer value.</h1>
              <p className="max-w-2xl text-sm leading-6 text-white/78">
                Built for the owner who checks in once a day. The important work is surfaced first: tasks due today, hot leads that have gone cold, and customers who deserve another call.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild className="bg-white text-slate-900 hover:bg-white/90">
                <Link to="/admin/crm/contacts/new">
                  New Contact
                  <Users className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                <Link to="/admin/crm/pipeline">Open Pipeline</Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <article className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Pipeline value</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-2xl font-semibold">{crmMoney.format(dashboard.pipelineValue)}</p>
                <Target className="h-6 w-6 text-white/80" />
              </div>
              <p className="mt-1 text-xs text-white/65">{dashboard.openDeals.length} open deals</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Due today</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-2xl font-semibold">{dueActivities.length.toLocaleString('en-IN')}</p>
                <CalendarClock className="h-6 w-6 text-white/80" />
              </div>
              <p className="mt-1 text-xs text-white/65">Checklist for the day</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Active leads</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-2xl font-semibold">{dashboard.activeLeads.length.toLocaleString('en-IN')}</p>
                <Hash className="h-6 w-6 text-white/80" />
              </div>
              <p className="mt-1 text-xs text-white/65">Ready for follow-up</p>
            </article>
            <article className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-[0.2em] text-white/60">Total contacts</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-2xl font-semibold">{contacts.length.toLocaleString('en-IN')}</p>
                <Users className="h-6 w-6 text-white/80" />
              </div>
              <p className="mt-1 text-xs text-white/65">Master customer list</p>
            </article>
          </div>
        </div>
      </div>

      {crmCompatibility.highlightReports || crmCompatibility.highlightSegments ? (
        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Recommended next steps</CardTitle>
            <CardDescription>Especially useful for product businesses that want to understand customer value.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {crmCompatibility.highlightReports ? (
              <Link to="/admin/crm/reports" className="rounded-2xl border bg-muted/20 p-4 transition hover:border-primary/40 hover:bg-muted/30">
                <p className="font-medium">Customer Value Reports</p>
                <p className="mt-1 text-sm text-muted-foreground">Spot your top buyers, retention patterns, and churn risk.</p>
              </Link>
            ) : null}
            {crmCompatibility.highlightSegments ? (
              <Link to="/admin/crm/segments" className="rounded-2xl border bg-muted/20 p-4 transition hover:border-primary/40 hover:bg-muted/30">
                <p className="font-medium">Segment-based outreach</p>
                <p className="mt-1 text-sm text-muted-foreground">Group customers by value or city before manual WhatsApp campaigns.</p>
              </Link>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className={panelClassName()}>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Today&apos;s Task List</CardTitle>
          <CardDescription>Activities scheduled for today or overdue. This is the list that keeps a small business moving.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {dueActivities.length ? (
            dueActivities.map((activity) => {
              const contact = contacts.find((item) => item.id === activity.contactId)
              const overdue = isOverdue(activity)
              const Icon = getActivityIcon(activity.type)

              return (
                <div
                  key={activity.id}
                  className={cn(
                    'rounded-xl border p-4 transition-colors',
                    overdue ? 'border-amber-300 bg-amber-50/80' : 'bg-muted/20'
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={cn('flex h-10 w-10 items-center justify-center rounded-full', overdue ? 'bg-amber-100 text-amber-700' : 'bg-slate-900 text-white')}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{contact ? getContactDisplayName(contact) : 'Unknown contact'}</p>
                          <Badge variant={overdue ? 'warning' : 'secondary'}>{activity.type}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{activity.subject}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.scheduledAt ? new Date(activity.scheduledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'No schedule'}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => completeActivity(activity.id, 'Completed from CRM dashboard')}>
                      Mark Complete
                    </Button>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No tasks due today. The queue is clear.</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Pipeline Summary</CardTitle>
            <CardDescription>Clickable stage overview. Jump into the pipeline filtered by stage.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {dashboard.stageSummary.map((stage) => {
                const width = Math.max(14, Math.round((stage.value / maxStageValue) * 100))
                return (
                  <Link
                    key={stage.stage}
                    to={`/admin/crm/pipeline?stage=${stage.stage}`}
                    className="min-w-[180px] shrink-0 rounded-2xl border bg-muted/20 p-4 transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant={stage.stage === 'CLOSED_WON' ? 'success' : stage.stage === 'CLOSED_LOST' ? 'destructive' : stage.stage === 'NEGOTIATION' ? 'warning' : 'secondary'}>
                        {stage.stage.replace('_', ' ')}
                      </Badge>
                      <p className="text-xs text-muted-foreground">{stage.count} deals</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${width}%` }} />
                    </div>
                    <div className="mt-3 space-y-1">
                      <p className="text-sm font-medium">{crmMoney.format(stage.value)}</p>
                      <p className="text-xs text-muted-foreground">Tap to filter the pipeline</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Hot Leads</CardTitle>
            <CardDescription>HOT-tagged leads with no activity in the last 7 days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.hotLeads.length ? (
              dashboard.hotLeads.map(({ contact, lastActivityAt }) => (
                <Link
                  key={contact.id}
                  to={`/admin/crm/contacts/${contact.id}`}
                  className="flex items-center justify-between rounded-xl border bg-muted/20 p-3 hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-full text-xs font-semibold', getContactAvatarClass(getContactDisplayName(contact)))}>
                      {getContactInitials(getContactDisplayName(contact))}
                    </div>
                    <div>
                      <p className="font-medium">{getContactDisplayName(contact)}</p>
                      <p className="text-xs text-muted-foreground">{contact.company || contact.city || 'No company'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive">HOT</Badge>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {lastActivityAt ? `${daysSince(lastActivityAt)} days quiet` : 'No activity yet'}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">No hot leads are currently overdue for a follow-up.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Recent Activity Feed</CardTitle>
            <CardDescription>Last 10 activities logged across all contacts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.recentFeed.map((activity) => {
              const contact = contacts.find((item) => item.id === activity.contactId)
              const Icon = getActivityIcon(activity.type)
              return (
                <div key={activity.id} className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={activity.status === 'COMPLETED' ? 'success' : activity.status === 'SCHEDULED' ? 'warning' : 'secondary'}>{activity.type}</Badge>
                          <p className="font-medium">{describeActivity(activity, contact ? getContactDisplayName(contact) : 'unknown contact')}</p>
                        </div>
                        <p className="text-sm text-muted-foreground">{activity.subject}</p>
                        {activity.outcome ? <p className="text-xs text-muted-foreground">{activity.outcome}</p> : null}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{formatActivityTime(activity)}</p>
                      {activity.createdBy ? <p className="mt-1 text-xs text-muted-foreground">By {activity.createdBy}</p> : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className={panelClassName()}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Customer Insights</CardTitle>
              <CardDescription>Top billed customers plus a churn-risk nudge.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Top 5 by purchase value</p>
                <div className="space-y-2">
                  {dashboard.topCustomers.length ? (
                    dashboard.topCustomers.map(({ customer, billing }) => (
                      <div key={customer.id} className="rounded-xl border bg-muted/20 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-xs text-muted-foreground">{billing.count} invoices</p>
                          </div>
                          <p className="font-semibold">{crmMoney.format(billing.total)}</p>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Last invoice: {formatDateOnly(billing.lastInvoiceAt)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No billed customers found yet.</div>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Churn risk alert</p>
                <div className="space-y-2">
                  {dashboard.churnRiskCustomers.length ? (
                    dashboard.churnRiskCustomers.map(({ customer, daysAway, lastPurchaseAt }) => (
                      <div key={customer.id} className="rounded-xl border border-amber-300 bg-amber-50/80 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium">{customer.name}</p>
                            <p className="text-xs text-muted-foreground">{customer.totalOrders} orders total</p>
                          </div>
                          <Badge variant="warning">{daysAway}d idle</Badge>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Last purchase: {formatDateOnly(lastPurchaseAt)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No obvious churn-risk customers right now.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
