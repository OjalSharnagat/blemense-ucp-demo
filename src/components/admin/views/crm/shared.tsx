import { Link } from 'react-router-dom'
import {
  CalendarClock,
  CheckSquare,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  StickyNote,
  Users,
  type LucideIcon
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Activity, Contact, Deal } from '@/data/crm'
import { cn } from '@/lib/utils'

export const crmMoney = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
})

export const crmDateTime = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short'
})

export const crmDate = new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium'
})

export const contactPalette = [
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-cyan-100 text-cyan-700',
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-pink-100 text-pink-700'
]

export const contactTypeLabel: Record<Contact['type'], string> = {
  CUSTOMER: 'Customer',
  LEAD: 'Lead',
  VENDOR: 'Vendor',
  PARTNER: 'Partner'
}

export const dealStageLabel: Record<Deal['stage'], string> = {
  LEAD: 'Lead',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  CLOSED_WON: 'Won',
  CLOSED_LOST: 'Lost'
}

export const dealStageStyles: Record<Deal['stage'], string> = {
  LEAD: 'border-slate-200 bg-slate-100 text-slate-700',
  QUALIFIED: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  PROPOSAL: 'border-blue-200 bg-blue-50 text-blue-800',
  NEGOTIATION: 'border-amber-200 bg-amber-50 text-amber-800',
  CLOSED_WON: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  CLOSED_LOST: 'border-rose-200 bg-rose-50 text-rose-800'
}

export const dealStageAccent: Record<Deal['stage'], string> = {
  LEAD: '#94a3b8',
  QUALIFIED: '#06b6d4',
  PROPOSAL: '#2563eb',
  NEGOTIATION: '#f59e0b',
  CLOSED_WON: '#10b981',
  CLOSED_LOST: '#ef4444'
}

export const activityTypeLabel: Record<Activity['type'], string> = {
  CALL: 'Call',
  EMAIL: 'Email',
  MEETING: 'Meeting',
  WHATSAPP: 'WhatsApp',
  DEMO: 'Demo',
  SITE_VISIT: 'Site visit',
  FOLLOW_UP: 'Follow up',
  NOTE: 'Note',
  TASK: 'Task'
}

export const activityTypeTone: Record<Activity['type'], string> = {
  CALL: 'border-sky-200 bg-sky-50 text-sky-900',
  EMAIL: 'border-violet-200 bg-violet-50 text-violet-900',
  MEETING: 'border-amber-200 bg-amber-50 text-amber-900',
  WHATSAPP: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  DEMO: 'border-blue-200 bg-blue-50 text-blue-900',
  SITE_VISIT: 'border-orange-200 bg-orange-50 text-orange-900',
  FOLLOW_UP: 'border-rose-200 bg-rose-50 text-rose-900',
  NOTE: 'border-slate-200 bg-slate-50 text-slate-900',
  TASK: 'border-indigo-200 bg-indigo-50 text-indigo-900'
}

export const activityTypeBg: Record<Activity['type'], string> = {
  CALL: 'bg-sky-100 text-sky-700',
  EMAIL: 'bg-violet-100 text-violet-700',
  MEETING: 'bg-amber-100 text-amber-700',
  WHATSAPP: 'bg-emerald-100 text-emerald-700',
  DEMO: 'bg-blue-100 text-blue-700',
  SITE_VISIT: 'bg-orange-100 text-orange-700',
  FOLLOW_UP: 'bg-rose-100 text-rose-700',
  NOTE: 'bg-slate-100 text-slate-700',
  TASK: 'bg-indigo-100 text-indigo-700'
}

const startOfToday = (date = new Date()): number => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next.getTime()
}

const endOfToday = (date = new Date()): number => {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next.getTime()
}

export function isActivityOverdue(activity: Activity): boolean {
  return activity.status === 'SCHEDULED' && Boolean(activity.scheduledAt) && new Date(activity.scheduledAt).getTime() < startOfToday()
}

export function getActivityIcon(type: Activity['type']): LucideIcon {
  switch (type) {
    case 'CALL':
      return Phone
    case 'EMAIL':
      return Mail
    case 'MEETING':
      return Users
    case 'WHATSAPP':
      return MessageCircle
    case 'DEMO':
      return CalendarClock
    case 'SITE_VISIT':
      return MapPin
    case 'NOTE':
      return StickyNote
    case 'TASK':
    case 'FOLLOW_UP':
    default:
      return CheckSquare
  }
}

export function describeActivity(activity: Activity, contactName: string): string {
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

export function getActivityTimestamp(activity: Activity): string {
  return activity.completedAt || activity.scheduledAt || new Date(0).toISOString()
}

export function formatActivityTime(activity: Activity): string {
  return new Date(getActivityTimestamp(activity)).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

export function ActivityDueBanner({ activities, className }: { activities: Activity[]; className?: string }) {
  const dueActivities = activities.filter((activity) => activity.status === 'SCHEDULED' && activity.scheduledAt && new Date(activity.scheduledAt).getTime() <= endOfToday())

  if (!dueActivities.length) return null

  const overdueCount = dueActivities.filter(isActivityOverdue).length
  const dueTodayCount = dueActivities.length - overdueCount

  return (
    <div
      className={cn(
        'rounded-2xl border border-rose-200 bg-rose-50/85 px-4 py-3 text-rose-950 shadow-[0_12px_30px_rgba(244,63,94,0.08)]',
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">
              {overdueCount ? `${overdueCount} overdue` : `${dueTodayCount} due today`}
            </p>
            <p className="text-sm text-rose-950/75">
              {overdueCount
                ? dueTodayCount > 0
                  ? `${dueTodayCount} more ${dueTodayCount === 1 ? 'activity' : 'activities'} are due today.`
                  : 'These overdue follow-ups need attention now.'
                : 'These are the follow-ups that should be handled first.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={overdueCount ? 'destructive' : 'warning'}>
            {dueActivities.length.toLocaleString('en-IN')} due
          </Badge>
          <Button asChild size="sm" variant="outline" className="border-rose-200 bg-white/80 text-rose-950 hover:bg-white">
            <Link to="/admin/crm/activities">View all</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

export function getContactInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'CR'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function getContactAvatarClass(name: string): string {
  if (!name) return contactPalette[0]
  return contactPalette[name.charCodeAt(0) % contactPalette.length]
}

export function getContactDisplayName(contact: Contact): string {
  return contact.displayName || `${contact.firstName} ${contact.lastName}`.trim() || contact.company || 'Unnamed contact'
}

export function getContactReference(contact: Contact): string {
  if (contact.company && contact.entityType === 'BUSINESS') {
    return contact.company
  }
  return [contact.designation, contact.city].filter(Boolean).join(' · ')
}

export function formatScore(score: number): string {
  return `${Math.max(0, Math.min(100, Math.round(score)))}`
}

export function ScoreBadge({ score }: { score: number }) {
  const variant = score >= 75 ? 'success' : score >= 45 ? 'warning' : 'secondary'
  return <Badge variant={variant}>{formatScore(score)}</Badge>
}

export function typeVariant(type: Contact['type']): 'default' | 'secondary' | 'warning' | 'success' {
  if (type === 'CUSTOMER') return 'success'
  if (type === 'LEAD') return 'warning'
  if (type === 'VENDOR') return 'secondary'
  return 'default'
}

export function statusVariant(status: Contact['status']): 'default' | 'secondary' | 'destructive' {
  if (status === 'ACTIVE') return 'default'
  if (status === 'BLOCKED') return 'destructive'
  return 'secondary'
}

export function ratingVariant(rating?: Contact['rating']): 'destructive' | 'warning' | 'secondary' {
  if (rating === 'HOT') return 'destructive'
  if (rating === 'WARM') return 'warning'
  return 'secondary'
}

export function stageVariant(stage: Deal['stage']): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' {
  if (stage === 'CLOSED_WON') return 'success'
  if (stage === 'CLOSED_LOST') return 'destructive'
  if (stage === 'NEGOTIATION') return 'warning'
  if (stage === 'PROPOSAL') return 'default'
  return 'secondary'
}

export function panelClassName(className?: string) {
  return cn(
    'rounded-2xl border border-border/80 bg-card/95 shadow-[0_12px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm',
    className
  )
}
