import { useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarClock,
  PieChart,
  ShoppingCart,
  TrendingUp,
  Users
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useBillingStore } from '@/lib/billingStore'
import { useCRMStore } from '@/lib/crmStore'
import { usePosStore } from '@/lib/posStore'
import type { Activity, Contact, Deal } from '@/data/crm'
import { crmDate, crmMoney, getContactDisplayName, panelClassName, stageVariant, dealStageLabel, contactTypeLabel, getActivityIcon, activityTypeLabel, getDealTerminology } from './shared'

type MonthBucket = {
  key: string
  label: string
  count: number
}

type ContactGrowthBucket = MonthBucket & {
  customers: number
  leads: number
  vendors: number
}

type DealStageBucket = {
  stage: Deal['stage']
  count: number
  value: number
}

type LossReasonBucket = {
  reason: string
  count: number
  color: string
}

type ActivityWeekBucket = MonthBucket

type TeamActivityBucket = {
  name: string
  scheduled: number
  overdue: number
}

type CustomerValueRow = {
  contact: Contact
  totalValue: number
  billingValue: number
  posValue: number
  purchaseCount: number
  firstPurchaseAt: string
  lastPurchaseAt: string
}

const MONTH_COLORS = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#f97316', '#8b5cf6', '#ef4444', '#14b8a6', '#6d28d9', '#ec4899']

const CHURN_WINDOWS = [60, 90, 180] as const

const startOfDay = (date: Date): Date => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1)

const addMonths = (date: Date, offset: number): Date => new Date(date.getFullYear(), date.getMonth() + offset, 1)

const startOfWeek = (date: Date): Date => {
  const next = startOfDay(date)
  const day = next.getDay()
  const delta = day === 0 ? 6 : day - 1
  next.setDate(next.getDate() - delta)
  return next
}

const monthKey = (date: Date): string => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

const weekKey = (date: Date): string => startOfWeek(date).toISOString().slice(0, 10)

const parseDate = (value?: string): Date | null => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const normalize = (value?: string): string => value?.trim().toLowerCase().replace(/\s+/g, ' ') || ''

const formatDays = (value: number): string => `${value.toFixed(value < 10 ? 1 : 0)} days`

const metricClass = 'rounded-2xl border border-border/80 bg-muted/20 p-4 shadow-sm'

const openDealStages = new Set<Deal['stage']>(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION'])
const closedStages = new Set<Deal['stage']>(['CLOSED_WON', 'CLOSED_LOST'])

function MetricCard({ label, value, sublabel }: { label: string; value: string; sublabel?: string }) {
  return (
    <Card className={panelClassName()}>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
        {sublabel ? <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p> : null}
      </CardContent>
    </Card>
  )
}

function BarChart({
  items,
  valueLabel,
  colorForIndex = (index: number) => MONTH_COLORS[index % MONTH_COLORS.length]
}: {
  items: Array<{ label: string; value: number }>
  valueLabel?: (value: number) => string
  colorForIndex?: (index: number) => string
}) {
  const max = Math.max(...items.map((item) => item.value), 0)

  return (
    <div className="space-y-3">
      <div className="flex h-56 items-end gap-2 overflow-hidden">
        {items.map((item, index) => {
          const height = max > 0 ? Math.max(12, (item.value / max) * 180) : 12
          return (
            <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <div className="flex h-full w-full items-end">
                <div
                  className="w-full rounded-t-2xl transition-all"
                  style={{
                    height: `${height}px`,
                    background: `linear-gradient(180deg, ${colorForIndex(index)} 0%, rgba(15, 23, 42, 0.82) 100%)`
                  }}
                  title={`${item.label}: ${valueLabel ? valueLabel(item.value) : item.value.toLocaleString('en-IN')}`}
                />
              </div>
              <div className="text-center">
                <p className="text-[11px] font-medium text-muted-foreground">{item.label}</p>
                <p className="text-xs font-semibold">{valueLabel ? valueLabel(item.value) : item.value.toLocaleString('en-IN')}</p>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span>{max.toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
}

function DonutChart({ items }: { items: LossReasonBucket[] }) {
  const total = items.reduce((sum, item) => sum + item.count, 0)
  const background = total
    ? `conic-gradient(${items
        .map((item, index) => {
          const start = items.slice(0, index).reduce((sum, current) => sum + current.count, 0)
          const startPercent = (start / total) * 100
          const endPercent = ((start + item.count) / total) * 100
          return `${item.color} ${startPercent}% ${endPercent}%`
        })
        .join(', ')})`
    : 'conic-gradient(#e2e8f0 0% 100%)'

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-32 w-32 shrink-0 rounded-full border border-border/70 p-3">
        <div className="h-full w-full rounded-full" style={{ background }} />
        <div className="absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-background text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Lost</p>
            <p className="text-sm font-semibold">{total.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {items.length ? items.map((item) => {
          const percent = total ? Math.round((item.count / total) * 100) : 0
          return (
            <div key={item.reason} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{item.reason}</span>
                <span className="shrink-0 text-muted-foreground">{percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: item.color }} />
              </div>
            </div>
          )
        }) : <p className="text-sm text-muted-foreground">No lost reasons recorded yet.</p>}
      </div>
    </div>
  )
}

function summarizeResponseTime(contacts: Contact[], activities: Activity[]): number {
  const firstActivityByContact = new Map<string, number>()
  activities.forEach((activity) => {
    const stamp = parseDate(activity.completedAt || activity.scheduledAt)
    if (!stamp) return
    const time = stamp.getTime()
    const existing = firstActivityByContact.get(activity.contactId)
    if (existing === undefined || time < existing) {
      firstActivityByContact.set(activity.contactId, time)
    }
  })

  const samples = contacts
    .map((contact) => {
      const firstActivity = firstActivityByContact.get(contact.id)
      if (firstActivity === undefined) return null
      const createdAt = parseDate(contact.createdAt)
      if (!createdAt) return null
      return Math.max(0, firstActivity - createdAt.getTime())
    })
    .filter((value): value is number => value !== null)

  if (!samples.length) return 0
  const avgMs = samples.reduce((sum, value) => sum + value, 0) / samples.length
  return avgMs / (1000 * 60 * 60 * 24)
}

function resolveCustomerKey(contact: Contact): string | null {
  if (contact.linkedCustomerId) return `customer:${contact.linkedCustomerId}`
  const name = normalize(getContactDisplayName(contact))
  if (name) return `name:${name}`
  return null
}

export default function CRMReports() {
  const { contacts, deals, activities, getDueActivities, settings } = useCRMStore()
  const { invoices } = useBillingStore()
  const { orders } = usePosStore()
  const dealTerm = getDealTerminology(settings)
  const [churnWindow, setChurnWindow] = useState<(typeof CHURN_WINDOWS)[number]>(90)

  const report = useMemo(() => {
    const contactGrowthByMonth = new Map<string, ContactGrowthBucket>()
    const currentMonth = startOfMonth(new Date())
    const visibleMonths = Array.from({ length: 12 }, (_, index) => addMonths(currentMonth, index - 11))

    visibleMonths.forEach((date) => {
      const key = monthKey(date)
      contactGrowthByMonth.set(key, {
        key,
        label: date.toLocaleDateString('en-IN', { month: 'short' }),
        count: 0,
        customers: 0,
        leads: 0,
        vendors: 0
      })
    })

    contacts.forEach((contact) => {
      const created = parseDate(contact.createdAt)
      if (!created) return
      const key = monthKey(created)
      const bucket = contactGrowthByMonth.get(key)
      if (!bucket) return
      bucket.count += 1
      if (contact.type === 'CUSTOMER') bucket.customers += 1
      if (contact.type === 'LEAD') bucket.leads += 1
      if (contact.type === 'VENDOR') bucket.vendors += 1
    })

    const sourceBreakdown = contacts.reduce<Record<string, number>>((acc, contact) => {
      const source = contact.source || 'OTHER'
      acc[source] = (acc[source] ?? 0) + 1
      return acc
    }, {})

    const totalContacts = contacts.length
    const activeLeads = contacts.filter((contact) => contact.type === 'LEAD' && contact.status === 'ACTIVE').length
    const openDeals = deals.filter((deal) => openDealStages.has(deal.stage))
    const pipelineValue = openDeals.reduce((sum, deal) => sum + deal.value, 0)
    const weightedPipelineValue = openDeals.reduce((sum, deal) => sum + deal.value * (deal.probability / 100), 0)
    const averageDealSize = deals.length ? deals.reduce((sum, deal) => sum + deal.value, 0) / deals.length : 0

    const closedDeals = deals.filter((deal) => closedStages.has(deal.stage))
    const wonDeals = closedDeals.filter((deal) => deal.stage === 'CLOSED_WON').length
    const winRate = closedDeals.length ? wonDeals / closedDeals.length : 0
    const salesCycleDays = deals
      .filter((deal) => deal.actualCloseDate)
      .map((deal) => {
        const createdAt = parseDate(deal.createdAt)
        const closedAt = parseDate(deal.actualCloseDate)
        if (!createdAt || !closedAt) return null
        return Math.max(0, (closedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
      })
      .filter((value): value is number => value !== null)
    const averageSalesCycle = salesCycleDays.length ? salesCycleDays.reduce((sum, value) => sum + value, 0) / salesCycleDays.length : 0

    const lossReasons = deals
      .filter((deal) => deal.stage === 'CLOSED_LOST')
      .reduce<Record<string, number>>((acc, deal) => {
        const reason = deal.lostReason?.trim() || 'No reason captured'
        acc[reason] = (acc[reason] ?? 0) + 1
        return acc
      }, {})

    const lossReasonBuckets: LossReasonBucket[] = Object.entries(lossReasons)
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count], index) => ({
        reason,
        count,
        color: MONTH_COLORS[index % MONTH_COLORS.length]
      }))

    const weeklyBuckets = new Map<string, ActivityWeekBucket>()
    const activityWindowStart = startOfWeek(new Date())
    const weeklySeries = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(activityWindowStart)
      date.setDate(date.getDate() - ((11 - index) * 7))
      const key = weekKey(date)
      const label = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      const bucket = { key, label, count: 0 }
      weeklyBuckets.set(key, bucket)
      return bucket
    })

    activities.forEach((activity) => {
      const stamp = parseDate(activity.completedAt || activity.scheduledAt)
      if (!stamp) return
      const week = startOfWeek(stamp)
      const key = weekKey(week)
      const bucket = weeklyBuckets.get(key)
      if (bucket) bucket.count += 1
    })

    const activityTypeBuckets = activities.reduce<Record<Activity['type'], number>>((acc, activity) => {
      acc[activity.type] = (acc[activity.type] ?? 0) + 1
      return acc
    }, {
      CALL: 0,
      EMAIL: 0,
      MEETING: 0,
      WHATSAPP: 0,
      DEMO: 0,
      SITE_VISIT: 0,
      FOLLOW_UP: 0,
      NOTE: 0,
      TASK: 0
    })

    const avgResponseDays = summarizeResponseTime(contacts, activities)
    const overdueActivities = activities.filter((activity) => activity.status === 'SCHEDULED' && activity.scheduledAt && parseDate(activity.scheduledAt) && parseDate(activity.scheduledAt)!.getTime() < startOfDay(new Date()).getTime())
    const overdueByMember = activities.reduce<Record<string, TeamActivityBucket>>((acc, activity) => {
      const name = activity.createdBy?.trim() || 'Unassigned'
      const current = acc[name] ?? { name, scheduled: 0, overdue: 0 }
      if (activity.status === 'SCHEDULED' && activity.scheduledAt) {
        current.scheduled += 1
        const stamp = parseDate(activity.scheduledAt)
        if (stamp && stamp.getTime() < startOfDay(new Date()).getTime()) {
          current.overdue += 1
        }
      }
      acc[name] = current
      return acc
    }, {})

    const billingValueByContact = new Map<string, number>()
    const posValueByContact = new Map<string, number>()
    const purchaseCountByContact = new Map<string, number>()
    const purchaseDatesByContact = new Map<string, number[]>()

    const contactLookupByCustomerId = new Map<string, Contact>()
    const contactLookupByName = new Map<string, Contact>()
    const contactLookupByPhone = new Map<string, Contact>()

    contacts.forEach((contact) => {
      if (contact.linkedCustomerId) {
        contactLookupByCustomerId.set(contact.linkedCustomerId, contact)
      }
      const name = normalize(getContactDisplayName(contact))
      if (name) {
        contactLookupByName.set(name, contact)
      }
      if (contact.phone) {
        contactLookupByPhone.set(normalize(contact.phone), contact)
      }
      if (contact.whatsapp) {
        contactLookupByPhone.set(normalize(contact.whatsapp), contact)
      }
    })

    const touchCustomer = (contact: Contact, value: number, timestamp: string | undefined, source: 'billing' | 'pos') => {
      const key = contact.id
      if (source === 'billing') {
        billingValueByContact.set(key, (billingValueByContact.get(key) ?? 0) + value)
      } else {
        posValueByContact.set(key, (posValueByContact.get(key) ?? 0) + value)
      }
      purchaseCountByContact.set(key, (purchaseCountByContact.get(key) ?? 0) + 1)
      const time = parseDate(timestamp)
      if (time) {
        const bucket = purchaseDatesByContact.get(key) ?? []
        bucket.push(time.getTime())
        purchaseDatesByContact.set(key, bucket)
      }
    }

    invoices.forEach((invoice) => {
      if (!invoice.customerId) return
      const contact = contactLookupByCustomerId.get(invoice.customerId)
      if (!contact) return
      touchCustomer(contact, invoice.taxBreakdown.grandTotal, invoice.issueDate, 'billing')
    })

    orders.forEach((order) => {
      let contact: Contact | undefined
      if (order.linkedInvoiceId) {
        const linkedInvoice = invoices.find((invoice) => invoice.id === order.linkedInvoiceId)
        if (linkedInvoice?.customerId) {
          contact = contactLookupByCustomerId.get(linkedInvoice.customerId)
        }
      }
      if (!contact && order.customerName) {
        const name = normalize(order.customerName)
        contact = contactLookupByName.get(name)
      }
      if (!contact && order.customerPhone) {
        contact = contactLookupByPhone.get(normalize(order.customerPhone))
      }
      if (!contact) return
      touchCustomer(contact, order.total, order.completedAt, 'pos')
    })

    const customerRows: CustomerValueRow[] = contacts
      .map((contact) => {
        const billingValue = billingValueByContact.get(contact.id) ?? 0
        const posValue = posValueByContact.get(contact.id) ?? 0
        const totalValue = billingValue + posValue
        const purchaseCount = purchaseCountByContact.get(contact.id) ?? 0
        if (totalValue <= 0 && purchaseCount <= 0) {
          return null
        }
        const timestamps = purchaseDatesByContact.get(contact.id) ?? []
        const sortedTimestamps = [...timestamps].sort((a, b) => a - b)
        return {
          contact,
          totalValue,
          billingValue,
          posValue,
          purchaseCount,
          firstPurchaseAt: sortedTimestamps[0] ? new Date(sortedTimestamps[0]).toISOString() : '',
          lastPurchaseAt: sortedTimestamps.length ? new Date(sortedTimestamps[sortedTimestamps.length - 1]).toISOString() : ''
        }
      })
      .filter((value): value is CustomerValueRow => Boolean(value))

    const buyingCustomers = customerRows.filter((row) => row.purchaseCount > 0)
    const returningCustomers = buyingCustomers.filter((row) => row.purchaseCount > 1).length
    const averageOrderFrequency = buyingCustomers.length ? buyingCustomers.reduce((sum, row) => sum + row.purchaseCount, 0) / buyingCustomers.length : 0
    const retentionRate = buyingCustomers.length ? returningCustomers / buyingCustomers.length : 0

    const churnCutoff = startOfDay(new Date())
    churnCutoff.setDate(churnCutoff.getDate() - churnWindow)
    const churnCandidates = buyingCustomers
      .filter((row) => {
        const lastPurchase = parseDate(row.lastPurchaseAt)
        if (!lastPurchase) return false
        return lastPurchase.getTime() < churnCutoff.getTime()
      })
      .sort((a, b) => (a.lastPurchaseAt && b.lastPurchaseAt ? new Date(a.lastPurchaseAt).getTime() - new Date(b.lastPurchaseAt).getTime() : 0))

    const topCustomerRows = [...customerRows]
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 20)

    return {
      totalContacts,
      activeLeads,
      openDeals: openDeals.length,
      pipelineValue,
      weightedPipelineValue,
      averageDealSize,
      averageSalesCycle,
      winRate,
      salesCycleDays,
      closedDeals: closedDeals.length,
      lossReasonBuckets,
      contactGrowth: Array.from(contactGrowthByMonth.values()),
      sourceBreakdown,
      weeklySeries,
      activityTypeBuckets,
      avgResponseDays,
      overdueActivities: overdueActivities.length,
      overdueByMember: Object.values(overdueByMember).sort((a, b) => b.overdue - a.overdue || b.scheduled - a.scheduled),
      customerRows: topCustomerRows,
      averageOrderFrequency,
      retentionRate,
      buyingCustomers: buyingCustomers.length,
      returningCustomers,
      churnCandidates
    }
  }, [activities, churnWindow, contacts, deals, getDueActivities, invoices, orders])

  const dueActivities = getDueActivities()
  const topLossReason = report.lossReasonBuckets[0]

  return (
    <div className="dash-view space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">CRM Reports</h1>
        <p className="text-sm text-muted-foreground">Owner-friendly reports for contact growth, pipeline health, activity discipline, and customer value.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Total contacts" value={report.totalContacts.toLocaleString('en-IN')} />
        <MetricCard label="Active leads" value={report.activeLeads.toLocaleString('en-IN')} sublabel="Open opportunities worth following up" />
        <MetricCard label="Open pipeline value" value={crmMoney.format(report.pipelineValue)} sublabel={`${report.openDeals.toLocaleString('en-IN')} open ${dealTerm.plural.toLowerCase()}`} />
        <MetricCard label="Activities due" value={dueActivities.length.toLocaleString('en-IN')} sublabel={`${report.overdueActivities.toLocaleString('en-IN')} overdue`} />
      </div>

      <Card className={panelClassName()}>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Contact Growth
          </CardTitle>
          <CardDescription>New contacts added each month, plus where they came from and which types are growing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-3">
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Customers</p>
              <p className="mt-2 text-2xl font-semibold">{report.contactGrowth.reduce((sum, month) => sum + month.customers, 0).toLocaleString('en-IN')}</p>
            </div>
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Leads</p>
              <p className="mt-2 text-2xl font-semibold">{report.contactGrowth.reduce((sum, month) => sum + month.leads, 0).toLocaleString('en-IN')}</p>
            </div>
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Vendors</p>
              <p className="mt-2 text-2xl font-semibold">{report.contactGrowth.reduce((sum, month) => sum + month.vendors, 0).toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.75fr]">
            <div className="rounded-2xl border bg-muted/10 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Last 12 months</p>
                  <p className="text-xs text-muted-foreground">Monthly contact additions</p>
                </div>
                <Badge variant="secondary">{report.contactGrowth.reduce((sum, month) => sum + month.count, 0).toLocaleString('en-IN')} total</Badge>
              </div>
              <BarChart items={report.contactGrowth.map((month) => ({ label: month.label, value: month.count }))} valueLabel={(value) => value.toLocaleString('en-IN')} />
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border bg-muted/10 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-medium">Type breakdown</p>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-3">
                  {(['CUSTOMER', 'LEAD', 'VENDOR', 'PARTNER'] as const).map((type) => {
                    const count = contacts.filter((contact) => contact.type === type).length
                    const percent = totalPercent(count, report.totalContacts)
                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span>{contactTypeLabel[type]}</span>
                          <span className="text-muted-foreground">{count.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-slate-900" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/10 p-4">
                <p className="mb-3 font-medium">Source breakdown</p>
                <div className="space-y-3">
                  {Object.entries(report.sourceBreakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([source, count], index) => {
                      const percent = totalPercent(count, report.totalContacts)
                      return (
                        <div key={source} className="space-y-1">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span>{source.replace(/_/g, ' ')}</span>
                            <Badge variant="secondary">{count.toLocaleString('en-IN')}</Badge>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: MONTH_COLORS[index % MONTH_COLORS.length] }} />
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={panelClassName()}>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Pipeline Health
          </CardTitle>
          <CardDescription>Track how much pipeline is active, how much is weighted, and why {dealTerm.plural.toLowerCase()} are being lost.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 lg:grid-cols-5">
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total pipeline</p>
              <p className="mt-2 text-2xl font-semibold">{crmMoney.format(report.pipelineValue)}</p>
            </div>
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Weighted pipeline</p>
              <p className="mt-2 text-2xl font-semibold">{crmMoney.format(report.weightedPipelineValue)}</p>
            </div>
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Average {dealTerm.singular.toLowerCase()} size</p>
              <p className="mt-2 text-2xl font-semibold">{crmMoney.format(report.averageDealSize)}</p>
            </div>
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Average sales cycle</p>
              <p className="mt-2 text-2xl font-semibold">{formatDays(report.averageSalesCycle)}</p>
            </div>
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Win rate</p>
              <p className="mt-2 text-2xl font-semibold">{Math.round(report.winRate * 100)}%</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border bg-muted/10 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">{dealTerm.singular} stage distribution</p>
                  <p className="text-xs text-muted-foreground">Open and closed pipeline by stage</p>
                </div>
                <Badge variant="secondary">{report.closedDeals.toLocaleString('en-IN')} closed</Badge>
              </div>
              <div className="space-y-3">
                {(['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'] as const).map((stage) => {
                  const stageDeals = deals.filter((deal) => deal.stage === stage)
                  const stageValue = stageDeals.reduce((sum, deal) => sum + deal.value, 0)
                  const count = stageDeals.length
                  const percent = totalPercent(stageValue, Math.max(report.pipelineValue, 1))
                  return (
                    <div key={stage} className="space-y-1">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <Badge variant={stageVariant(stage)}>{dealStageLabel[stage]}</Badge>
                        <span className="text-muted-foreground">
                          {count.toLocaleString('en-IN')} {dealTerm.plural.toLowerCase()} · {crmMoney.format(stageValue)}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-blue-600" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl border bg-muted/10 p-4">
              <div className="mb-4 flex items-center gap-2">
                <PieChart className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">Loss reasons</p>
              </div>
              <DonutChart items={report.lossReasonBuckets} />
              {topLossReason ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Most common loss reason: <span className="font-medium text-foreground">{topLossReason.reason}</span>
                </p>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className={panelClassName()}>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Activity Report
          </CardTitle>
          <CardDescription>Spot follow-up discipline, activity mix, and how quickly new contacts are getting attention.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Activities logged</p>
              <p className="mt-2 text-2xl font-semibold">{activities.length.toLocaleString('en-IN')}</p>
            </div>
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg response time</p>
              <p className="mt-2 text-2xl font-semibold">{formatDays(report.avgResponseDays)}</p>
            </div>
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Overdue activities</p>
              <p className="mt-2 text-2xl font-semibold">{report.overdueActivities.toLocaleString('en-IN')}</p>
            </div>
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Due today</p>
              <p className="mt-2 text-2xl font-semibold">{dueActivities.length.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border bg-muted/10 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Activities per week</p>
                  <p className="text-xs text-muted-foreground">Weekly logging trend</p>
                </div>
                <Badge variant="secondary">{report.weeklySeries.reduce((sum, week) => sum + week.count, 0).toLocaleString('en-IN')}</Badge>
              </div>
              <BarChart items={report.weeklySeries.map((week) => ({ label: week.label, value: week.count }))} valueLabel={(value) => value.toLocaleString('en-IN')} />
            </div>

            <div className="rounded-2xl border bg-muted/10 p-4">
              <p className="mb-4 font-medium">Activity type mix</p>
              <div className="space-y-3">
                {Object.entries(report.activityTypeBuckets)
                  .filter(([, count]) => count > 0)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count], index) => {
                    const Icon = getActivityIcon(type as Activity['type'])
                    const percent = totalPercent(count, activities.length || 1)
                    return (
                      <div key={type} className="space-y-1">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/80">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span>{activityTypeLabel[type as Activity['type']]}</span>
                          </div>
                          <Badge variant="secondary">{count.toLocaleString('en-IN')}</Badge>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: MONTH_COLORS[index % MONTH_COLORS.length] }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-muted/10 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-medium">Overdue activity rate by team member</p>
                <p className="text-xs text-muted-foreground">Scheduled work that is running late</p>
              </div>
              <Badge variant="warning">{report.overdueActivities.toLocaleString('en-IN')} overdue</Badge>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team member</TableHead>
                  <TableHead className="text-right">Scheduled</TableHead>
                  <TableHead className="text-right">Overdue</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.overdueByMember.map((member) => {
                  const rate = member.scheduled ? member.overdue / member.scheduled : 0
                  return (
                    <TableRow key={member.name}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell className="text-right">{member.scheduled.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right">{member.overdue.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right">{Math.round(rate * 100)}%</TableCell>
                    </TableRow>
                  )
                })}
                {!report.overdueByMember.length ? (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No activity ownership data yet.</div>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className={panelClassName()}>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Customer Value Report
          </CardTitle>
          <CardDescription>Cross-reference billing and POS activity to understand who is actually worth chasing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Buying customers</p>
              <p className="mt-2 text-2xl font-semibold">{report.buyingCustomers.toLocaleString('en-IN')}</p>
            </div>
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Retention rate</p>
              <p className="mt-2 text-2xl font-semibold">{Math.round(report.retentionRate * 100)}%</p>
            </div>
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Average order frequency</p>
              <p className="mt-2 text-2xl font-semibold">{report.averageOrderFrequency.toFixed(1)}</p>
            </div>
            <div className={metricClass}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Return buyers</p>
              <p className="mt-2 text-2xl font-semibold">{report.returningCustomers.toLocaleString('en-IN')}</p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-2xl border bg-muted/10 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium">Top 20 customers by lifetime value</p>
                  <p className="text-xs text-muted-foreground">Billing value plus POS spend</p>
                </div>
                <Badge variant="secondary">{report.customerRows.length.toLocaleString('en-IN')} shown</Badge>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Lifetime value</TableHead>
                    <TableHead className="text-right">Purchases</TableHead>
                    <TableHead>Last purchase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.customerRows.map((row) => {
                    const max = report.customerRows[0]?.totalValue || 1
                    const width = Math.max(6, (row.totalValue / max) * 100)
                    return (
                      <TableRow key={row.contact.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <Link to={`/admin/crm/contacts/${row.contact.id}`} className="font-medium hover:text-primary">
                              {getContactDisplayName(row.contact)}
                            </Link>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{contactTypeLabel[row.contact.type]}</Badge>
                              {row.contact.company ? <span className="text-xs text-muted-foreground">{row.contact.company}</span> : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="space-y-1">
                            <p className="font-medium">{crmMoney.format(row.totalValue)}</p>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{row.purchaseCount.toLocaleString('en-IN')}</TableCell>
                        <TableCell>{row.lastPurchaseAt ? crmDate.format(new Date(row.lastPurchaseAt)) : 'No purchases'}</TableCell>
                      </TableRow>
                    )
                  })}
                  {!report.customerRows.length ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No customer revenue linked yet.</div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border bg-muted/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-medium">Churn analysis</p>
                  <Select value={String(churnWindow)} onChange={(event) => setChurnWindow(Number(event.target.value) as (typeof CHURN_WINDOWS)[number])}>
                    {CHURN_WINDOWS.map((window) => (
                      <option key={window} value={window}>
                        No purchase in {window} days
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={metricClass}>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">At risk</p>
                    <p className="mt-2 text-2xl font-semibold">{report.churnCandidates.length.toLocaleString('en-IN')}</p>
                  </div>
                  <div className={metricClass}>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">No activity threshold</p>
                    <p className="mt-2 text-2xl font-semibold">{churnWindow}d</p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {report.churnCandidates.slice(0, 8).map((row) => (
                    <div key={row.contact.id} className="rounded-xl border bg-background/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{getContactDisplayName(row.contact)}</p>
                          <p className="text-xs text-muted-foreground">{row.contact.company || row.contact.city || 'No company linked'}</p>
                        </div>
                        <Badge variant="warning">{row.purchaseCount} purchases</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Last purchase: {row.lastPurchaseAt ? crmDate.format(new Date(row.lastPurchaseAt)) : 'No purchase history'}
                      </p>
                    </div>
                  ))}
                  {!report.churnCandidates.length ? (
                    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No churn risk at this threshold.</div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border bg-muted/10 p-4">
                <p className="font-medium">What this means</p>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li>Customers with repeat buying are the ones worth chasing first.</li>
                  <li>Contacts sitting past the churn threshold need a reactivation nudge.</li>
                  <li>Lifetime value blends billing invoices and POS spend so the picture is not skewed.</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function totalPercent(value: number, total: number): number {
  if (!total) return 0
  return Math.max(4, Math.min(100, (value / total) * 100))
}
