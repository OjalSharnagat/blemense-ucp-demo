import { createContext, createElement, type PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react'
import {
  crmActivities,
  crmCampaigns,
  crmContacts,
  crmDeals,
  crmSegments,
  crmSettings,
  type Activity,
  type ActivityStatus,
  type ActivityType,
  type Campaign,
  type CampaignContactResult,
  type Contact,
  type ContactNote,
  type Deal,
  type Segment,
  type CRMSettings
} from '@/data/crm'
import { useAdminStore } from '@/lib/store'
import { useBillingStore } from '@/lib/billingStore'
import { usePosStore } from '@/lib/posStore'
import {
  evaluateSegmentConditions,
  type SegmentMetrics
} from '@/lib/crmSegments'
import { findBestContactMatch, splitName } from '@/lib/crmSync'
import { getCRMCompatibilityConfig, type CRMCompatibilityConfig } from '@/lib/businessMode'

export type ContactTimelineEntry =
  | {
      id: string
      kind: 'ACTIVITY'
      timestamp: string
      title: string
      detail?: string
      status: ActivityStatus
      createdBy?: string
      reference?: string
    }
  | {
      id: string
      kind: 'DEAL_STAGE'
      timestamp: string
      title: string
      detail?: string
      status: Deal['stage']
      amount: number
      createdBy?: string
      reference?: string
    }
  | {
      id: string
      kind: 'ORDER'
      timestamp: string
      title: string
      detail?: string
      status: string
      amount: number
      createdBy?: string
      reference?: string
    }
  | {
      id: string
      kind: 'INVOICE'
      timestamp: string
      title: string
      detail?: string
      status: string
      amount: number
      createdBy?: string
      reference?: string
    }
  | {
      id: string
      kind: 'PAYMENT'
      timestamp: string
      title: string
      detail?: string
      status: string
      amount: number
      createdBy?: string
      reference?: string
    }
  | {
      id: string
      kind: 'POS_ORDER'
      timestamp: string
      title: string
      detail?: string
      status: string
      amount: number
      createdBy?: string
      reference?: string
    }
  | {
      id: string
      kind: 'NOTE'
      timestamp: string
      title: string
      detail?: string
      status: string
      createdBy?: string
      reference?: string
    }
  | {
      id: string
      kind: 'CONTACT_UPDATED'
      timestamp: string
      title: string
      detail?: string
      status: Contact['status']
      createdBy?: string
      reference?: string
    }

type ContactInput = Omit<Contact, 'id' | 'avatar' | 'createdAt' | 'updatedAt'> & {
  id?: string
  avatar?: string
  createdAt?: string
  updatedAt?: string
}

type DealInput = Omit<Deal, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string
  createdAt?: string
  updatedAt?: string
}

type ActivityInput = Omit<Activity, 'id'> & {
  id?: string
}

type SegmentInput = Omit<Segment, 'id' | 'createdAt'> & {
  id?: string
  createdAt?: string
}

type CampaignInput = Omit<Campaign, 'id' | 'createdAt' | 'updatedAt' | 'contactCount' | 'respondedCount' | 'convertedCount'> & {
  id?: string
  createdAt?: string
  updatedAt?: string
  contactCount?: number
  respondedCount?: number
  convertedCount?: number
  contactResults?: CampaignContactResult[]
}

type ContactNoteInput = Omit<ContactNote, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string
  createdAt?: string
  updatedAt?: string
}

type CRMStoreValue = {
  contacts: Contact[]
  deals: Deal[]
  activities: Activity[]
  segments: Segment[]
  campaigns: Campaign[]
  contactNotes: ContactNote[]
  settings: CRMSettings
  updateSettings: (nextSettings: CRMSettings) => CRMSettings
  createContact: (contact: ContactInput) => Contact
  updateContact: (contact: Contact) => void
  deleteContact: (contactId: string) => void
  mergeContacts: (survivorId: string, duplicateId: string) => Contact | null
  createDeal: (deal: DealInput) => Deal
  updateDeal: (deal: Deal) => void
  moveDealStage: (dealId: string, newStage: Deal['stage']) => Deal | null
  closeDeal: (dealId: string, won: boolean, reason?: string) => Deal | null
  logActivity: (activity: ActivityInput) => Activity
  updateActivity: (activity: Activity) => void
  completeActivity: (activityId: string, outcome?: string) => Activity | null
  scheduleFollowUp: (contactId: string, date: string, type?: ActivityType) => Activity
  createSegment: (segment: SegmentInput) => Segment
  updateSegment: (segment: Segment) => void
  evaluateDynamicSegment: (segmentId: string) => string[]
  createCampaign: (campaign: CampaignInput) => Campaign
  updateCampaign: (campaign: Campaign) => void
  addContactNote: (note: ContactNoteInput) => ContactNote
  getDueActivities: () => Activity[]
  getContactTimeline: (contactId: string) => ContactTimelineEntry[]
  computeContactScore: (contactId: string) => number
}

const CRMStoreContext = createContext<CRMStoreValue | null>(null)
const CRM_SETTINGS_STORAGE_KEY = 'blemense-crm-settings'

const generateId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const startOfToday = (date = new Date()): Date => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

const endOfToday = (date = new Date()): Date => {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

const formatDisplayName = (contact: Pick<Contact, 'firstName' | 'lastName' | 'company' | 'displayName'>): string => {
  if (contact.displayName.trim()) return contact.displayName.trim()
  if (contact.company?.trim()) return contact.company.trim()
  return `${contact.firstName} ${contact.lastName}`.trim()
}

const dedupeStrings = (values: Array<string | undefined | null>): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))]

const buildInitialContactNotes = (): ContactNote[] =>
  crmContacts.flatMap((contact) => {
    if (!contact.notes?.trim()) return []

    const timestamp = contact.updatedAt || contact.createdAt || new Date().toISOString()
    return [
      {
        id: `crm-note-${contact.id}`,
        contactId: contact.id,
        body: contact.notes.trim(),
        author: contact.assignedTo || crmSettings.defaultAssignee,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ]
  })

const buildContactAvatar = (contact: Pick<Contact, 'displayName' | 'firstName' | 'lastName' | 'company'>): string => {
  const source = contact.displayName || contact.company || `${contact.firstName} ${contact.lastName}`
  const parts = source
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!parts.length) return 'CR'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

const mergeContactRecords = (primary: Contact, duplicate: Contact): Contact => {
  const now = new Date().toISOString()
  const earliestCreatedAt = [primary.createdAt, duplicate.createdAt].sort()[0] ?? now
  const latestContact = [primary.lastContactedAt, duplicate.lastContactedAt].filter(Boolean).sort().slice(-1)[0]

  return {
    ...primary,
    firstName: primary.firstName || duplicate.firstName,
    lastName: primary.lastName || duplicate.lastName,
    displayName: formatDisplayName({
      firstName: primary.firstName || duplicate.firstName,
      lastName: primary.lastName || duplicate.lastName,
      company: primary.company || duplicate.company,
      displayName: primary.displayName || duplicate.displayName
    }),
    company: primary.company || duplicate.company,
    designation: primary.designation || duplicate.designation,
    email: primary.email || duplicate.email,
    phone: primary.phone || duplicate.phone,
    altPhone: primary.altPhone || duplicate.altPhone,
    whatsapp: primary.whatsapp || duplicate.whatsapp,
    address: primary.address || duplicate.address,
    city: primary.city || duplicate.city,
    state: primary.state || duplicate.state,
    pincode: primary.pincode || duplicate.pincode,
    gstin: primary.gstin || duplicate.gstin,
    pan: primary.pan || duplicate.pan,
    source: primary.source || duplicate.source,
    tags: dedupeStrings([...duplicate.tags, ...primary.tags]),
    assignedTo: primary.assignedTo || duplicate.assignedTo,
    rating: primary.rating || duplicate.rating,
    status: primary.status === 'ACTIVE' ? 'ACTIVE' : duplicate.status === 'ACTIVE' ? 'ACTIVE' : primary.status,
    notes: dedupeStrings([primary.notes, duplicate.notes]).join('\n\n') || undefined,
    avatar: primary.avatar || duplicate.avatar || buildContactAvatar(primary),
    linkedCustomerId: primary.linkedCustomerId ?? duplicate.linkedCustomerId ?? null,
    createdAt: earliestCreatedAt,
    updatedAt: now,
    lastContactedAt: latestContact,
    birthday: primary.birthday || duplicate.birthday,
    anniversary: primary.anniversary || duplicate.anniversary,
    customFields: {
      ...duplicate.customFields,
      ...primary.customFields
    }
  }
}

const toTimelineTimestamp = (value?: string): string => value || new Date(0).toISOString()

const buildDefaultCRMSettings = (compatibility: CRMCompatibilityConfig): CRMSettings => ({
  ...crmSettings,
  enableSalesPipeline: compatibility.enableSalesPipeline,
  enableCampaigns: compatibility.enableCampaigns,
  enableTeamFeatures: compatibility.enableTeamFeatures,
  dealTerminology: compatibility.dealTerminology
})

const mergeCRMSettings = (base: CRMSettings, next?: Partial<CRMSettings> | null): CRMSettings => ({
  ...base,
  ...(next || {}),
  teamMembers: next?.teamMembers?.length ? next.teamMembers : base.teamMembers,
  dealStages: next?.dealStages?.length ? next.dealStages : base.dealStages,
  leadSources: next?.leadSources?.length ? next.leadSources : base.leadSources,
  customContactFields: next?.customContactFields?.length ? next.customContactFields : base.customContactFields,
  reminderDefaults: {
    ...base.reminderDefaults,
    ...(next?.reminderDefaults || {})
  }
})

export function CRMStoreProvider({ children }: PropsWithChildren) {
  const { businessProfile } = useBillingStore()
  const { customers, orders } = useAdminStore()
  const { invoices, payments } = useBillingStore()
  const { orders: posOrders } = usePosStore()
  const compatibility = getCRMCompatibilityConfig(businessProfile)
  const defaultCRMSettings = useMemo(() => buildDefaultCRMSettings(compatibility), [compatibility])
  const [contacts, setContacts] = useState<Contact[]>(crmContacts)
  const [deals, setDeals] = useState<Deal[]>(crmDeals)
  const [activities, setActivities] = useState<Activity[]>(crmActivities)
  const [segments, setSegments] = useState<Segment[]>(crmSegments)
  const [campaigns, setCampaigns] = useState<Campaign[]>(crmCampaigns)
  const [contactNotes, setContactNotes] = useState<ContactNote[]>(buildInitialContactNotes)
  const [settings, setSettings] = useState<CRMSettings>(() => {
    if (typeof window === 'undefined') return defaultCRMSettings

    try {
      const stored = window.localStorage.getItem(CRM_SETTINGS_STORAGE_KEY)
      if (!stored) return defaultCRMSettings
      const parsed = JSON.parse(stored) as Partial<CRMSettings>
      return mergeCRMSettings(defaultCRMSettings, parsed)
    } catch {
      return defaultCRMSettings
    }
  })

  useEffect(() => {
    try {
      window.localStorage.setItem(CRM_SETTINGS_STORAGE_KEY, JSON.stringify(settings))
    } catch {
      // Ignore storage failures in demo mode.
    }
  }, [settings])

  const buildPurchaseMetrics = (contact: Contact): SegmentMetrics => {
    const customerId = contact.linkedCustomerId || undefined
    const customer = customers.find((item) => item.id === customerId)
    const contactName = contact.displayName.trim().toLowerCase()
    const contactCompany = contact.company?.trim().toLowerCase() || ''
    const contactEmail = contact.email?.trim().toLowerCase() || ''
    const contactPhones = [contact.phone, contact.whatsapp, contact.altPhone]
      .map((value) => value?.replace(/\D/g, '') || '')
      .filter((value): value is string => Boolean(value))

    const relatedInvoices = invoices.filter((invoice) => {
      if (invoice.crmContactId === contact.id) return true
      if (invoice.customerId === customerId) return true
      const buyerName = invoice.buyer.name.trim().toLowerCase()
      const buyerEmail = invoice.buyer.email.trim().toLowerCase()
      const buyerPhone = invoice.buyer.phone.replace(/\D/g, '')
      return buyerName === contactName || (contactCompany && buyerName === contactCompany) || (contactEmail && buyerEmail === contactEmail) || (buyerPhone && contactPhones.includes(buyerPhone))
    })
    const relatedOrders = orders.filter((order) => {
      if (order.crmContactId === contact.id) return true
      if (order.customerId === customerId) return true
      const orderName = (order.customerName || '').trim().toLowerCase()
      const orderEmail = (order.customerEmail || order.email || '').trim().toLowerCase()
      return orderName === contactName || (contactCompany && orderName === contactCompany) || (contactEmail && orderEmail === contactEmail)
    })
    const relatedPosOrders = posOrders.filter((order) => {
      if (order.crmContactId === contact.id) return true
      const orderName = (order.customerName || '').trim().toLowerCase()
      const orderPhone = (order.customerPhone || '').replace(/\D/g, '')
      return (
        (orderPhone && contactPhones.includes(orderPhone)) ||
        orderName === contactName ||
        (contactCompany && orderName === contactCompany)
      )
    })

    const totalSpent =
      (customer?.totalSpent ?? 0) +
      relatedInvoices.reduce((sum, invoice) => sum + invoice.taxBreakdown.grandTotal, 0) +
      relatedPosOrders.reduce((sum, order) => sum + order.total, 0)

    const purchaseDates = [
      ...(customer?.orderIds?.map((orderId) => orders.find((order) => order.id === orderId)?.date || '') ?? []),
      ...relatedOrders.map((order) => order.date || order.createdAt || ''),
      ...relatedInvoices.map((invoice) => invoice.issueDate),
      ...relatedPosOrders.map((order) => order.completedAt)
    ]
      .filter(Boolean)
      .sort()

    return {
      totalSpent,
      lastPurchaseDate: purchaseDates.slice(-1)[0],
      purchaseCount: (customer?.orderIds?.length ?? 0) + relatedOrders.length + relatedInvoices.length + relatedPosOrders.length
    }
  }

  const computeContactScore = (contactId: string): number => {
    const contact = contacts.find((item) => item.id === contactId)
    if (!contact) return 0

    const relatedDeals = deals.filter((deal) => deal.contactId === contactId)
    const relatedActivities = activities.filter((activity) => activity.contactId === contactId)
    const relatedPayments = payments.filter((payment) => {
      if (payment.crmContactId === contactId) return true
      if (payment.customerId && payment.customerId === contact.linkedCustomerId) return true
      const invoice = invoices.find((item) => item.id === payment.invoiceId)
      if (!invoice) return false
      if (invoice.crmContactId === contactId) return true
      if (contact.linkedCustomerId && invoice.customerId === contact.linkedCustomerId) return true
      return (
        invoice.buyer.name.toLowerCase() === contact.displayName.toLowerCase() ||
        (contact.email ? invoice.buyer.email.toLowerCase() === contact.email.toLowerCase() : false)
      )
    })
    const purchaseMetrics = buildPurchaseMetrics(contact)

    const daysSincePurchase = purchaseMetrics.lastPurchaseDate
      ? Math.max(0, Math.floor((Date.now() - new Date(purchaseMetrics.lastPurchaseDate).getTime()) / 86400000))
      : 365
    const recencyScore =
      daysSincePurchase <= 7 ? 28 : daysSincePurchase <= 30 ? 22 : daysSincePurchase <= 90 ? 14 : daysSincePurchase <= 180 ? 6 : 0

    const interactionScore = Math.min(22, relatedActivities.length * 2 + Math.max(0, relatedActivities.filter((activity) => activity.status === 'COMPLETED').length))
    const dealScore = Math.min(24, relatedDeals.reduce((sum, deal) => sum + deal.value, 0) / 12000)
    const purchaseScore = Math.min(26, purchaseMetrics.totalSpent / 12000)
    const paymentReliabilityScore = Math.min(8, relatedPayments.length * 2)
    const leadMomentumScore = contact.rating === 'HOT' ? 8 : contact.rating === 'WARM' ? 4 : contact.rating === 'COLD' ? 1 : 0

    const rawScore = purchaseScore + recencyScore + interactionScore + dealScore + paymentReliabilityScore + leadMomentumScore
    return Math.max(0, Math.min(100, Math.round(rawScore)))
  }

  const evaluateDynamicSegmentIds = (segmentId: string): string[] => {
    const segment = segments.find((item) => item.id === segmentId)
    if (!segment || segment.type !== 'DYNAMIC') return []

    return contacts
      .filter((contact) => {
        const score = computeContactScore(contact.id)
        const metrics = buildPurchaseMetrics(contact)
        return evaluateSegmentConditions(contact, segment.conditions, segment.conditionLogic, score, metrics)
      })
      .map((contact) => contact.id)
  }

  const getCampaignTargetContactIds = (segmentId?: string): string[] => {
    if (!segmentId) return []
    const segment = segments.find((item) => item.id === segmentId)
    if (!segment) return []
    return segment.type === 'DYNAMIC' ? evaluateDynamicSegmentIds(segment.id) : segment.contactIds
  }

  const maxDateValue = (a?: string, b?: string): string | undefined => {
    const values = [a, b].filter(Boolean) as string[]
    if (!values.length) return a || b
    return values.sort((left, right) => new Date(left).getTime() - new Date(right).getTime()).slice(-1)[0]
  }

  const syncContactsFromExternalRecords = (prevContacts: Contact[]): Contact[] => {
    let nextContacts = [...prevContacts]

    type ContactSyncDraft = Partial<Contact> & {
      type: Contact['type']
      entityType: Contact['entityType']
      firstName: string
      lastName: string
      displayName: string
      avatar: string
      status: Contact['status']
      tags: string[]
      customFields: Contact['customFields']
      createdAt: string
      updatedAt: string
      lastContactedAt?: string
      assignedTo?: string
      source?: string
      linkedCustomerId?: string | null
    }

    const upsertContact = (identity: { crmContactId?: string | null; linkedCustomerId?: string | null; name?: string | null; company?: string | null; email?: string | null; phone?: string | null }, draft: ContactSyncDraft) => {
      const matched = findBestContactMatch(nextContacts, identity)
      if (matched) {
        nextContacts = nextContacts.map((contact) =>
          contact.id === matched.id
            ? {
                ...contact,
                type: contact.type || draft.type,
                entityType: contact.entityType || draft.entityType,
                firstName: contact.firstName || draft.firstName,
                lastName: contact.lastName || draft.lastName,
                displayName: contact.displayName || draft.displayName,
                company: contact.company || draft.company,
                designation: contact.designation || draft.designation,
                email: contact.email || draft.email,
                phone: contact.phone || draft.phone,
                altPhone: contact.altPhone || draft.altPhone,
                whatsapp: contact.whatsapp || draft.whatsapp,
                address: contact.address || draft.address,
                city: contact.city || draft.city,
                state: contact.state || draft.state,
                pincode: contact.pincode || draft.pincode,
                gstin: contact.gstin || draft.gstin,
                pan: contact.pan || draft.pan,
                source: contact.source || draft.source,
                tags: dedupeStrings([...contact.tags, ...draft.tags]),
                assignedTo: contact.assignedTo || draft.assignedTo || settings.defaultAssignee,
                rating: contact.rating || draft.rating,
                status: contact.status || draft.status,
                notes: contact.notes || draft.notes,
                avatar: contact.avatar || draft.avatar,
                linkedCustomerId: contact.linkedCustomerId ?? draft.linkedCustomerId ?? null,
                createdAt: contact.createdAt || draft.createdAt,
                lastContactedAt: maxDateValue(contact.lastContactedAt, draft.lastContactedAt || draft.updatedAt),
                updatedAt: draft.updatedAt
              }
            : contact
        )
        return
      }

      nextContacts = [
        {
          ...draft,
          id: generateId('crm-con'),
          assignedTo: draft.assignedTo || settings.defaultAssignee,
          avatar: draft.avatar || buildContactAvatar(draft),
          source: draft.source || 'OTHER',
          notes: draft.notes || undefined,
          birthday: draft.birthday || undefined,
          anniversary: draft.anniversary || undefined,
          linkedCustomerId: draft.linkedCustomerId ?? null,
          lastContactedAt: draft.lastContactedAt
        } as Contact,
        ...nextContacts
      ]
    }

    for (const invoice of invoices) {
      const buyerName = invoice.buyer.name || invoice.buyer.email || 'Billing customer'
      const { firstName, lastName, displayName } = splitName(buyerName)
      upsertContact(
        {
          crmContactId: invoice.crmContactId,
          linkedCustomerId: invoice.customerId ?? null,
          name: invoice.buyer.name,
          company: invoice.buyer.name,
          email: invoice.buyer.email,
          phone: invoice.buyer.phone
        },
        {
          type: 'CUSTOMER',
          entityType: invoice.buyer.isRegistered ? 'BUSINESS' : 'INDIVIDUAL',
          firstName,
          lastName,
          displayName,
          company: invoice.buyer.name,
          designation: undefined,
          email: invoice.buyer.email || undefined,
          phone: invoice.buyer.phone || undefined,
          altPhone: undefined,
          whatsapp: invoice.buyer.phone || undefined,
          address: invoice.buyer.address || undefined,
          city: invoice.buyer.city || undefined,
          state: invoice.buyer.state || undefined,
          pincode: invoice.buyer.pincode || undefined,
          gstin: invoice.buyer.gstin || undefined,
          pan: invoice.buyer.pan || undefined,
          source: 'BILLING',
          tags: ['billing'],
          assignedTo: settings.defaultAssignee,
          rating: undefined,
          status: 'ACTIVE',
          notes: undefined,
          avatar: buildContactAvatar({ firstName, lastName, company: invoice.buyer.name, displayName }),
          linkedCustomerId: invoice.customerId ?? null,
          createdAt: invoice.createdAt,
          updatedAt: invoice.updatedAt || invoice.createdAt,
          lastContactedAt: invoice.issueDate,
          customFields: {}
        }
      )
    }

    for (const payment of payments) {
      const invoice = invoices.find((item) => item.id === payment.invoiceId)
      const contactIdentity = {
        crmContactId: payment.crmContactId ?? invoice?.crmContactId ?? undefined,
        linkedCustomerId: payment.customerId ?? invoice?.customerId ?? null,
        name: invoice?.buyer.name,
        company: invoice?.buyer.name,
        email: invoice?.buyer.email,
        phone: invoice?.buyer.phone
      }
      const matched = findBestContactMatch(nextContacts, contactIdentity)
      if (matched) {
        nextContacts = nextContacts.map((contact) =>
          contact.id === matched.id
            ? {
                ...contact,
                linkedCustomerId: contact.linkedCustomerId ?? payment.customerId ?? invoice?.customerId ?? null,
                lastContactedAt: maxDateValue(contact.lastContactedAt, payment.date),
                updatedAt: new Date().toISOString()
              }
            : contact
        )
      }
    }

    for (const order of orders) {
      const sourceCustomer = customers.find((customer) => customer.id === order.customerId)
      const buyerName = order.customerName || sourceCustomer?.name || order.email || 'Online customer'
      const { firstName, lastName, displayName } = splitName(buyerName)
      upsertContact(
        {
          crmContactId: order.crmContactId,
          linkedCustomerId: order.customerId ?? null,
          name: buyerName,
          email: order.customerEmail || order.email,
          company: sourceCustomer?.name || undefined
        },
        {
          type: 'CUSTOMER',
          entityType: 'INDIVIDUAL',
          firstName,
          lastName,
          displayName,
          company: sourceCustomer?.name || undefined,
          designation: undefined,
          email: order.customerEmail || order.email || undefined,
          phone: undefined,
          altPhone: undefined,
          whatsapp: undefined,
          address: undefined,
          city: undefined,
          state: undefined,
          pincode: undefined,
          gstin: undefined,
          pan: undefined,
          source: 'WEBSITE',
          tags: ['order'],
          assignedTo: settings.defaultAssignee,
          rating: undefined,
          status: 'ACTIVE',
          notes: undefined,
          avatar: buildContactAvatar({ firstName, lastName, company: sourceCustomer?.name, displayName }),
          linkedCustomerId: order.customerId ?? null,
          createdAt: order.createdAt || order.date || new Date().toISOString(),
          updatedAt: order.createdAt || order.date || new Date().toISOString(),
          lastContactedAt: order.createdAt || order.date || new Date().toISOString(),
          customFields: {}
        }
      )
    }

    for (const order of posOrders) {
      const buyerName = order.customerName || 'POS customer'
      const { firstName, lastName, displayName } = splitName(buyerName)
      const identity = {
        crmContactId: order.crmContactId,
        name: buyerName,
        phone: order.customerPhone
      }
      const matched = findBestContactMatch(nextContacts, identity)
      if (matched) {
        nextContacts = nextContacts.map((contact) =>
          contact.id === matched.id
            ? {
                ...contact,
                lastContactedAt: maxDateValue(contact.lastContactedAt, order.completedAt),
                updatedAt: new Date().toISOString()
              }
            : contact
        )
        continue
      }

      nextContacts = [
        {
          id: generateId('crm-con'),
          type: 'CUSTOMER',
          entityType: 'INDIVIDUAL',
          firstName,
          lastName,
          displayName,
          company: undefined,
          designation: undefined,
          email: undefined,
          phone: order.customerPhone || undefined,
          altPhone: undefined,
          whatsapp: order.customerPhone || undefined,
          address: undefined,
          city: undefined,
          state: undefined,
          pincode: undefined,
          gstin: undefined,
          pan: undefined,
          source: 'POS',
          tags: ['pos'],
          assignedTo: settings.defaultAssignee,
          rating: undefined,
          status: 'ACTIVE',
          notes: undefined,
          avatar: buildContactAvatar({ firstName, lastName, displayName }),
          linkedCustomerId: null,
          createdAt: order.completedAt,
          updatedAt: order.completedAt,
          lastContactedAt: order.completedAt,
          customFields: {}
        },
        ...nextContacts
      ]
    }

    return nextContacts
  }

  useEffect(() => {
    setContacts((prev) => syncContactsFromExternalRecords(prev))
  }, [customers, invoices, orders, payments, posOrders, settings.defaultAssignee])

  const value = useMemo<CRMStoreValue>(
    () => ({
      contacts,
      deals,
      activities,
      segments,
      campaigns,
      contactNotes,
      settings,
      updateSettings: (nextSettings) => {
        setSettings(nextSettings)
        return nextSettings
      },
      createContact: (contact) => {
        const createdAt = contact.createdAt || new Date().toISOString()
        const updatedAt = contact.updatedAt || createdAt
        const displayName = formatDisplayName(contact)
        const nextContact: Contact = {
          ...contact,
          id: contact.id || generateId('crm-con'),
          displayName,
          avatar: contact.avatar || buildContactAvatar(contact),
          createdAt,
          updatedAt
        }

        setContacts((prev) => [nextContact, ...prev])
        if (contact.notes?.trim()) {
          const timestamp = createdAt
          setContactNotes((prev) => [
            {
              id: generateId('crm-note'),
              contactId: nextContact.id,
              body: contact.notes.trim(),
              author: nextContact.assignedTo || settings.defaultAssignee,
              createdAt: timestamp,
              updatedAt: timestamp
            },
            ...prev
          ])
        }
        return nextContact
      },
      updateContact: (contact) => {
        setContacts((prev) => prev.map((item) => (item.id === contact.id ? { ...contact, updatedAt: new Date().toISOString() } : item)))
      },
      deleteContact: (contactId) => {
        setContacts((prev) => prev.filter((item) => item.id !== contactId))
        setDeals((prev) => prev.filter((deal) => deal.contactId !== contactId))
        setActivities((prev) => prev.filter((activity) => activity.contactId !== contactId))
        setContactNotes((prev) => prev.filter((note) => note.contactId !== contactId))
        setSegments((prev) =>
          prev.map((segment) =>
            segment.type === 'STATIC'
              ? { ...segment, contactIds: segment.contactIds.filter((id) => id !== contactId) }
              : segment
          )
        )
      },
      mergeContacts: (survivorId, duplicateId) => {
        let merged: Contact | null = null
        setContacts((prev) => {
          const survivor = prev.find((contact) => contact.id === survivorId)
          const duplicate = prev.find((contact) => contact.id === duplicateId)
          if (!survivor || !duplicate) {
            return prev
          }

          merged = mergeContactRecords(survivor, duplicate)
          return prev
            .filter((contact) => contact.id !== duplicateId)
            .map((contact) => (contact.id === survivorId ? merged! : contact))
        })

        if (merged) {
          setDeals((prev) => prev.map((deal) => (deal.contactId === duplicateId ? { ...deal, contactId: survivorId } : deal)))
          setActivities((prev) => prev.map((activity) => (activity.contactId === duplicateId ? { ...activity, contactId: survivorId } : activity)))
          setContactNotes((prev) => prev.map((note) => (note.contactId === duplicateId ? { ...note, contactId: survivorId, updatedAt: new Date().toISOString() } : note)))
          setSegments((prev) =>
            prev.map((segment) =>
              segment.type === 'STATIC'
                ? { ...segment, contactIds: dedupeStrings(segment.contactIds.map((id) => (id === duplicateId ? survivorId : id))) }
                : segment
            )
          )
        }

        return merged
      },
      createDeal: (deal) => {
        const now = new Date().toISOString()
        const nextDeal: Deal = {
          ...deal,
          id: deal.id || generateId('crm-deal'),
          createdAt: deal.createdAt || now,
          updatedAt: deal.updatedAt || now,
          stageChangedAt: deal.stageChangedAt || deal.createdAt || now
        }
        setDeals((prev) => [nextDeal, ...prev])
        return nextDeal
      },
      updateDeal: (deal) => {
        setDeals((prev) =>
          prev.map((item) =>
            item.id === deal.id
              ? {
                  ...deal,
                  stageChangedAt: item.stage === deal.stage ? item.stageChangedAt : new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
              : item
          )
        )
      },
      moveDealStage: (dealId, newStage) => {
        let updatedDeal: Deal | null = null
        setDeals((prev) =>
          prev.map((deal) => {
            if (deal.id !== dealId) return deal
            updatedDeal = {
              ...deal,
              stage: newStage,
              probability: newStage === 'CLOSED_WON' ? 100 : newStage === 'CLOSED_LOST' ? 0 : deal.probability,
              actualCloseDate: newStage.startsWith('CLOSED') ? deal.actualCloseDate || new Date().toISOString() : undefined,
              lostReason: newStage === 'CLOSED_LOST' ? deal.lostReason || 'No reason recorded' : undefined,
              stageChangedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
            return updatedDeal
          })
        )
        return updatedDeal
      },
      closeDeal: (dealId, won, reason) => {
        let updatedDeal: Deal | null = null
        setDeals((prev) =>
          prev.map((deal) => {
            if (deal.id !== dealId) return deal
            updatedDeal = {
              ...deal,
              stage: won ? 'CLOSED_WON' : 'CLOSED_LOST',
              probability: won ? 100 : 0,
              actualCloseDate: new Date().toISOString(),
              lostReason: won ? undefined : reason || 'No reason recorded',
              stageChangedAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
            return updatedDeal
          })
        )
        return updatedDeal
      },
      logActivity: (activity) => {
        const nextActivity: Activity = {
          ...activity,
          id: activity.id || generateId('crm-act'),
          attachments: activity.attachments || []
        }
        setActivities((prev) => [nextActivity, ...prev])
        setContacts((prev) =>
          prev.map((contact) =>
            contact.id === nextActivity.contactId
              ? { ...contact, lastContactedAt: nextActivity.completedAt || nextActivity.scheduledAt || new Date().toISOString(), updatedAt: new Date().toISOString() }
              : contact
          )
        )
        return nextActivity
      },
      updateActivity: (activity) => {
        setActivities((prev) => prev.map((item) => (item.id === activity.id ? activity : item)))
      },
      completeActivity: (activityId, outcome) => {
        let updatedActivity: Activity | null = null
        setActivities((prev) =>
          prev.map((activity) => {
            if (activity.id !== activityId) return activity
            updatedActivity = {
              ...activity,
              outcome: outcome || activity.outcome,
              completedAt: new Date().toISOString(),
              status: 'COMPLETED'
            }
            return updatedActivity
          })
        )

        if (updatedActivity) {
          setContacts((prev) =>
            prev.map((contact) =>
              contact.id === updatedActivity!.contactId
                ? { ...contact, lastContactedAt: updatedActivity!.completedAt, updatedAt: new Date().toISOString() }
                : contact
            )
          )
        }

        return updatedActivity
      },
      scheduleFollowUp: (contactId, date, type = 'FOLLOW_UP') => {
        const nextActivity: Activity = {
          id: generateId('crm-act'),
          type,
          contactId,
          subject: 'Scheduled follow-up',
          description: 'Auto-generated follow-up reminder.',
          scheduledAt: date,
          status: 'SCHEDULED',
          createdBy: settings.defaultAssignee,
          reminder: settings.reminderDefaults.followUp,
          attachments: []
        }
        setActivities((prev) => [nextActivity, ...prev])
        return nextActivity
      },
      createSegment: (segment) => {
        const now = new Date().toISOString()
        const nextSegment: Segment = {
          ...segment,
          id: segment.id || generateId('crm-seg'),
          createdAt: segment.createdAt || now,
          updatedAt: segment.updatedAt || now
        }
        setSegments((prev) => [nextSegment, ...prev])
        return nextSegment
      },
      updateSegment: (segment) => {
        const updatedAt = new Date().toISOString()
        setSegments((prev) => prev.map((item) => (item.id === segment.id ? { ...segment, updatedAt } : item)))
      },
      evaluateDynamicSegment: (segmentId) => {
        return evaluateDynamicSegmentIds(segmentId)
      },
      createCampaign: (campaign) => {
        const now = new Date().toISOString()
        const targetContactIds = getCampaignTargetContactIds(campaign.segmentId)
        const nextResults = campaign.contactResults?.length
          ? campaign.contactResults
          : targetContactIds.map((contactId) => ({
              contactId,
              contacted: false,
              response: 'NO_RESPONSE' as const,
              notes: '',
              updatedAt: new Date().toISOString()
            }))
        const respondedCount = nextResults.filter((result) => result.response !== 'NO_RESPONSE').length
        const convertedCount = nextResults.filter((result) => result.response === 'CONVERTED').length
        const nextCampaign: Campaign = {
          ...campaign,
          id: campaign.id || generateId('crm-camp'),
          createdAt: campaign.createdAt || now,
          updatedAt: campaign.updatedAt || now,
          contactCount: campaign.contactCount ?? targetContactIds.length,
          respondedCount: campaign.respondedCount ?? respondedCount,
          convertedCount: campaign.convertedCount ?? convertedCount,
          contactResults: nextResults
        }
        setCampaigns((prev) => [nextCampaign, ...prev])
        return nextCampaign
      },
      updateCampaign: (campaign) => {
        const updatedAt = campaign.updatedAt || new Date().toISOString()
        setCampaigns((prev) => prev.map((item) => (item.id === campaign.id ? { ...campaign, updatedAt } : item)))
      },
      addContactNote: (note) => {
        const now = new Date().toISOString()
        const nextNote: ContactNote = {
          ...note,
          id: note.id || generateId('crm-note'),
          createdAt: note.createdAt || now,
          updatedAt: note.updatedAt || now
        }
        setContactNotes((prev) => [nextNote, ...prev])
        setContacts((prev) =>
          prev.map((contact) =>
            contact.id === nextNote.contactId
              ? { ...contact, updatedAt: now }
              : contact
          )
        )
        return nextNote
      },
      getDueActivities: () =>
        activities
          .filter((activity) => activity.status === 'SCHEDULED' && activity.scheduledAt && new Date(activity.scheduledAt).getTime() <= endOfToday().getTime())
          .sort((a, b) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime()),
      getContactTimeline: (contactId) => {
        const contact = contacts.find((item) => item.id === contactId)
        if (!contact) return []

        const relatedActivities = activities
          .filter((activity) => activity.contactId === contactId)
          .map<ContactTimelineEntry>((activity) => ({
            id: activity.id,
            kind: 'ACTIVITY',
            timestamp: toTimelineTimestamp(activity.completedAt || activity.scheduledAt),
            title: activity.subject,
            detail: activity.outcome || activity.description,
            status: activity.status,
            createdBy: activity.createdBy || settings.defaultAssignee,
            reference: activity.dealId
          }))

        const relatedDeals = deals
          .filter((deal) => deal.contactId === contactId)
          .map<ContactTimelineEntry>((deal) => ({
            id: deal.id,
            kind: 'DEAL_STAGE',
            timestamp: toTimelineTimestamp(deal.actualCloseDate || deal.stageChangedAt || deal.updatedAt || deal.createdAt),
            title: deal.title,
            detail: deal.notes || `Deal stage changed to ${deal.stage}`,
            status: deal.stage,
            amount: deal.value,
            createdBy: deal.assignedTo || settings.defaultAssignee,
            reference: deal.stage
          }))

        const contactCustomerId = contact.linkedCustomerId || undefined
        const adminCustomer = customers.find((customer) => customer.id === contactCustomerId)
        const normalizedName = contact.displayName.toLowerCase()
        const normalizedPhone = (contact.phone || contact.whatsapp || '').replace(/\D/g, '')

        const relatedOrders = orders
          .filter((order) => {
            if (order.crmContactId === contactId) return true
            if (contactCustomerId && order.customerId === contactCustomerId) return true
            if (adminCustomer && order.customerId === adminCustomer.id) return true
            const orderPhone = (order.customerEmail || order.email || '').toLowerCase()
            const orderName = (order.customerName || '').toLowerCase()
            return orderName === normalizedName || (contact.email ? orderPhone === contact.email.toLowerCase() : false)
          })
          .map<ContactTimelineEntry>((order) => ({
            id: order.id,
            kind: 'ORDER',
            timestamp: toTimelineTimestamp(order.date || order.createdAt),
            title: `Order ${order.id}`,
            detail: order.customerName ? `${order.customerName} · ${order.items.length} items` : `${order.items.length} items`,
            status: order.status,
            amount: order.total,
            createdBy: order.customerName || 'Orders',
            reference: order.invoiceId || order.id
          }))

        const relatedInvoices = invoices
          .filter((invoice) => {
            if (invoice.crmContactId === contactId) return true
            if (contactCustomerId && invoice.customerId === contactCustomerId) return true
            return invoice.buyer.name.toLowerCase() === normalizedName || (contact.email ? invoice.buyer.email.toLowerCase() === contact.email.toLowerCase() : false)
          })
          .map<ContactTimelineEntry>((invoice) => ({
            id: invoice.id,
            kind: 'INVOICE',
            timestamp: toTimelineTimestamp(invoice.issueDate),
            title: 'Invoice created',
            detail: `${invoice.invoiceNumber} · ${invoice.buyer.name} · balance ${invoice.balanceDue}`,
            status: invoice.status,
            amount: invoice.taxBreakdown.grandTotal,
            createdBy: invoice.seller.tradeName,
            reference: invoice.orderId || invoice.customerId
          }))

        const relatedPayments = payments
          .filter((payment) => {
            if (payment.crmContactId === contactId) return true
            if (contactCustomerId && payment.customerId === contactCustomerId) return true
            const paymentInvoice = invoices.find((invoice) => invoice.id === payment.invoiceId)
            if (!paymentInvoice) return false
            if (paymentInvoice.crmContactId === contactId) return true
            if (contactCustomerId && paymentInvoice.customerId === contactCustomerId) return true
            return (
              paymentInvoice.buyer.name.toLowerCase() === normalizedName ||
              (contact.email ? paymentInvoice.buyer.email.toLowerCase() === contact.email.toLowerCase() : false)
            )
          })
          .map<ContactTimelineEntry>((payment) => ({
            id: payment.id,
            kind: 'PAYMENT',
            timestamp: toTimelineTimestamp(payment.date),
            title: 'Payment received',
            detail: payment.reference || payment.notes,
            status: 'RECORDED',
            amount: payment.amount,
            createdBy: payment.mode,
            reference: payment.invoiceId
          }))

        const relatedPosOrders = posOrders
          .filter((order) => {
            if (order.crmContactId === contactId) return true
            const orderName = (order.customerName || '').toLowerCase()
            const orderPhone = (order.customerPhone || '').replace(/\D/g, '')
            return (
              (contact.phone && orderPhone === normalizedPhone) ||
              (contact.whatsapp && orderPhone === contact.whatsapp.replace(/\D/g, '')) ||
              orderName === normalizedName
            )
          })
          .map<ContactTimelineEntry>((order) => ({
            id: order.id,
            kind: 'POS_ORDER',
            timestamp: toTimelineTimestamp(order.completedAt),
            title: 'POS order made',
            detail: order.notes || `${order.items.length} items`,
            status: order.status,
            amount: order.total,
            createdBy: order.customerName || 'POS',
            reference: order.linkedInvoiceId || order.id
          }))

        const relatedNotes = contactNotes
          .filter((note) => note.contactId === contactId)
          .map<ContactTimelineEntry>((note) => ({
            id: note.id,
            kind: 'NOTE',
            timestamp: toTimelineTimestamp(note.updatedAt || note.createdAt),
            title: 'Note added',
            detail: note.body,
            status: 'NOTE',
            createdBy: note.author,
            reference: note.contactId
          }))

        const contactUpdated = contact.updatedAt
          ? [
              {
                id: `${contact.id}-updated`,
                kind: 'CONTACT_UPDATED' as const,
                timestamp: toTimelineTimestamp(contact.updatedAt),
                title: 'Contact updated',
                detail: 'Profile fields were updated.',
                status: contact.status,
                createdBy: contact.assignedTo || settings.defaultAssignee,
                reference: contact.id
              }
            ]
          : []

        return [...relatedActivities, ...relatedDeals, ...relatedOrders, ...relatedInvoices, ...relatedPayments, ...relatedPosOrders, ...relatedNotes, ...contactUpdated].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
      },
      computeContactScore
    }),
    [activities, campaigns, contactNotes, contacts, customers, deals, invoices, orders, posOrders, settings, segments]
  )

  return createElement(CRMStoreContext.Provider, { value }, children)
}

export function useCRMStore() {
  const context = useContext(CRMStoreContext)
  if (!context) {
    throw new Error('useCRMStore must be used within <CRMStoreProvider>.')
  }
  return context
}
