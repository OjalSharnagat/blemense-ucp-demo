export type ContactType = 'CUSTOMER' | 'LEAD' | 'VENDOR' | 'PARTNER'
export type EntityType = 'INDIVIDUAL' | 'BUSINESS'
export type ContactSource = 'WALK_IN' | 'REFERRAL' | 'WEBSITE' | 'SOCIAL_MEDIA' | 'COLD_CALL' | 'EXHIBITION' | 'OTHER'
export type ContactRating = 'HOT' | 'WARM' | 'COLD'
export type ContactStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
export type DealStage = 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'CLOSED_WON' | 'CLOSED_LOST'
export type ActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'WHATSAPP' | 'DEMO' | 'SITE_VISIT' | 'FOLLOW_UP' | 'NOTE' | 'TASK'
export type ActivityStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'MISSED'
export type SegmentType = 'STATIC' | 'DYNAMIC'
export type SegmentOperator =
  | 'EQUALS'
  | 'NOT_EQUALS'
  | 'CONTAINS'
  | 'GREATER_THAN'
  | 'LESS_THAN'
  | 'IS_EMPTY'
  | 'IN_LAST_DAYS'
  | 'OLDER_THAN_DAYS'
  | 'BEFORE_DATE'
  | 'AFTER_DATE'
  | 'ON'
export type CampaignType = 'WHATSAPP' | 'EMAIL' | 'CALL' | 'SMS'
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED'
export type SegmentLogic = 'AND' | 'OR'
export type CampaignResponseStatus = 'NO_RESPONSE' | 'INTERESTED' | 'NOT_INTERESTED' | 'CONVERTED'

export interface Contact {
  id: string
  type: ContactType
  entityType: EntityType
  firstName: string
  lastName: string
  displayName: string
  company?: string
  designation?: string
  email?: string
  phone?: string
  altPhone?: string
  whatsapp?: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  gstin?: string
  pan?: string
  source?: ContactSource
  tags: string[]
  assignedTo?: string
  rating?: ContactRating
  status: ContactStatus
  notes?: string
  avatar: string
  linkedCustomerId?: string | null
  createdAt: string
  updatedAt: string
  lastContactedAt?: string
  birthday?: string
  anniversary?: string
  customFields: Record<string, string | number | boolean | null | undefined>
}

export interface ContactNote {
  id: string
  contactId: string
  body: string
  author: string
  createdAt: string
  updatedAt: string
}

export interface Deal {
  id: string
  title: string
  contactId: string
  value: number
  currency: string
  stage: DealStage
  probability: number
  expectedCloseDate?: string
  actualCloseDate?: string
  assignedTo?: string
  productIds: string[]
  notes?: string
  lostReason?: string
  source?: ContactSource
  tags: string[]
  activities: string[]
  stageChangedAt?: string
  createdAt: string
  updatedAt: string
}

export interface Activity {
  id: string
  type: ActivityType
  contactId: string
  dealId?: string
  subject: string
  description?: string
  outcome?: string
  scheduledAt?: string
  completedAt?: string
  duration?: number
  status: ActivityStatus
  createdBy?: string
  reminder?: number
  attachments: string[]
}

export interface SegmentCondition {
  field: keyof Contact | `customFields.${string}` | 'score' | 'totalSpent' | 'lastPurchaseDate'
  operator: SegmentOperator
  value?: string | number | boolean
}

export interface Segment {
  id: string
  name: string
  description?: string
  type: SegmentType
  conditionLogic?: SegmentLogic
  conditions: SegmentCondition[]
  contactIds: string[]
  color: string
  createdAt: string
  updatedAt: string
}

export interface Campaign {
  id: string
  name: string
  type: CampaignType
  segmentId?: string
  status: CampaignStatus
  startDate?: string
  endDate?: string
  message: string
  contactCount: number
  respondedCount: number
  convertedCount: number
  notes?: string
  contactResults?: CampaignContactResult[]
  createdAt: string
  updatedAt?: string
}

export interface CampaignContactResult {
  contactId: string
  contacted: boolean
  response: CampaignResponseStatus
  notes?: string
  contactedAt?: string
  updatedAt?: string
  activityId?: string
}

export interface CRMSettings {
  defaultAssignee: string
  dealStages: DealStage[]
  leadSources: ContactSource[]
  customContactFields: string[]
  reminderDefaults: {
    call: number
    meeting: number
    followUp: number
  }
  enableBirthdayReminders: boolean
  enableFollowUpAlerts: boolean
}

const seedNow = new Date()

const isoAt = (daysOffset: number, hour = 9, minute = 0): string => {
  const date = new Date(seedNow)
  date.setDate(date.getDate() + daysOffset)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

const initials = (value: string): string => {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (!parts.length) return 'CR'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export const crmContacts: Contact[] = [
  {
    id: 'crm-con-001',
    type: 'CUSTOMER',
    entityType: 'INDIVIDUAL',
    firstName: 'Aarav',
    lastName: 'Mehta',
    displayName: 'Aarav Mehta',
    company: 'Mehta Menswear',
    designation: 'Owner',
    email: 'aarav.mehta@example.com',
    phone: '+91-98200-11001',
    whatsapp: '+91-98200-11001',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    source: 'WALK_IN',
    tags: ['repeat-buyer', 'fabric'],
    assignedTo: 'Naman Arora',
    status: 'ACTIVE',
    notes: 'Buys every 4-6 weeks during season change.',
    avatar: initials('Aarav Mehta'),
    linkedCustomerId: 'cus_9001',
    createdAt: isoAt(-310),
    updatedAt: isoAt(-4),
    lastContactedAt: isoAt(-6),
    birthday: isoAt(-10950),
    customFields: { preferredLanguage: 'Hindi', monthlyPotential: 25000 }
  },
  {
    id: 'crm-con-002',
    type: 'CUSTOMER',
    entityType: 'INDIVIDUAL',
    firstName: 'Sana',
    lastName: 'Kapoor',
    displayName: 'Sana Kapoor',
    company: 'Kapoor Styling Studio',
    designation: 'Founder',
    email: 'sana.kapoor@example.com',
    phone: '+91-98711-22002',
    whatsapp: '+91-98711-22002',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    source: 'REFERRAL',
    tags: ['design-studio', 'premium'],
    assignedTo: 'Meera Joshi',
    status: 'ACTIVE',
    notes: 'Likes fast turnaround and WhatsApp updates.',
    avatar: initials('Sana Kapoor'),
    linkedCustomerId: 'cus_9002',
    createdAt: isoAt(-290),
    updatedAt: isoAt(-3),
    lastContactedAt: isoAt(-2),
    birthday: isoAt(-12000),
    customFields: { preferredLanguage: 'English', creditLimit: 50000 }
  },
  {
    id: 'crm-con-003',
    type: 'LEAD',
    entityType: 'INDIVIDUAL',
    firstName: 'Dev',
    lastName: 'Shah',
    displayName: 'Dev Shah',
    designation: 'Procurement Head',
    email: 'dev.shah@sunrisepackers.in',
    phone: '+91-98212-33003',
    whatsapp: '+91-98212-33003',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380015',
    source: 'WEBSITE',
    tags: ['bulk', 'new-lead'],
    assignedTo: 'Rohit Kumar',
    rating: 'HOT',
    status: 'ACTIVE',
    notes: 'Requested a quote for uniform supply across three stores.',
    avatar: initials('Dev Shah'),
    createdAt: isoAt(-45),
    updatedAt: isoAt(-1),
    lastContactedAt: isoAt(-1),
    customFields: { expectedMonthlySpend: 75000, preferredChannel: 'WhatsApp' }
  },
  {
    id: 'crm-con-004',
    type: 'CUSTOMER',
    entityType: 'INDIVIDUAL',
    firstName: 'Nidhi',
    lastName: 'Rao',
    displayName: 'Nidhi Rao',
    company: 'Rao Home Decor',
    designation: 'Purchase Manager',
    email: 'nidhi.rao@example.com',
    phone: '+91-98108-44004',
    whatsapp: '+91-98108-44004',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560001',
    source: 'EXHIBITION',
    tags: ['interstate', 'decor'],
    assignedTo: 'Meera Joshi',
    status: 'ACTIVE',
    notes: 'Prefers monthly statement and net-15 settlements.',
    avatar: initials('Nidhi Rao'),
    linkedCustomerId: 'cus_9004',
    createdAt: isoAt(-220),
    updatedAt: isoAt(-5),
    lastContactedAt: isoAt(-7),
    anniversary: isoAt(-5000),
    customFields: { preferredPaymentMode: 'UPI', monthlyPotential: 40000 }
  },
  {
    id: 'crm-con-005',
    type: 'CUSTOMER',
    entityType: 'INDIVIDUAL',
    firstName: 'Kabir',
    lastName: 'Singh',
    displayName: 'Kabir Singh',
    company: 'Kabir Home Studio',
    email: 'kabir.singh@example.com',
    phone: '+91-98716-55005',
    whatsapp: '+91-98716-55005',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302001',
    source: 'REFERRAL',
    tags: ['lapsed', 'small-order'],
    assignedTo: 'Naman Arora',
    status: 'INACTIVE',
    notes: 'No purchase for more than six months.',
    avatar: initials('Kabir Singh'),
    linkedCustomerId: 'cus_9005',
    createdAt: isoAt(-360),
    updatedAt: isoAt(-90),
    lastContactedAt: isoAt(-95),
    customFields: { lastOrderValue: 8100 }
  },
  {
    id: 'crm-con-006',
    type: 'CUSTOMER',
    entityType: 'INDIVIDUAL',
    firstName: 'Ishita',
    lastName: 'Nair',
    displayName: 'Ishita Nair',
    company: 'Nair Office Solutions',
    designation: 'Operations Lead',
    email: 'ishita.nair@example.com',
    phone: '+91-98400-66006',
    whatsapp: '+91-98400-66006',
    city: 'Kochi',
    state: 'Kerala',
    pincode: '682011',
    source: 'WEBSITE',
    tags: ['repeat-buyer', 'service'],
    assignedTo: 'Rohit Kumar',
    status: 'ACTIVE',
    notes: 'Buys for office events and annual replenishment.',
    avatar: initials('Ishita Nair'),
    linkedCustomerId: 'cus_9006',
    createdAt: isoAt(-250),
    updatedAt: isoAt(-11),
    lastContactedAt: isoAt(-11),
    birthday: isoAt(-13000),
    customFields: { preferredLanguage: 'English', annualPotential: 90000 }
  },
  {
    id: 'crm-con-007',
    type: 'CUSTOMER',
    entityType: 'INDIVIDUAL',
    firstName: 'Rohan',
    lastName: 'Verma',
    displayName: 'Rohan Verma',
    company: 'Verma Lifestyle',
    email: 'rohan.verma@example.com',
    phone: '+91-98111-77007',
    whatsapp: '+91-98111-77007',
    city: 'Delhi',
    state: 'Delhi',
    pincode: '110001',
    source: 'SOCIAL_MEDIA',
    tags: ['fashion', 'active'],
    assignedTo: 'Naman Arora',
    status: 'ACTIVE',
    notes: 'Asks for sample photos before bulk purchase.',
    avatar: initials('Rohan Verma'),
    linkedCustomerId: 'cus_9007',
    createdAt: isoAt(-270),
    updatedAt: isoAt(-8),
    lastContactedAt: isoAt(-4),
    customFields: { instagramHandle: '@vermalifestyle' }
  },
  {
    id: 'crm-con-008',
    type: 'CUSTOMER',
    entityType: 'INDIVIDUAL',
    firstName: 'Maya',
    lastName: 'Iyer',
    displayName: 'Maya Iyer',
    company: 'Maya Market Hub',
    designation: 'Owner',
    email: 'maya.iyer@example.com',
    phone: '+91-97610-88008',
    whatsapp: '+91-97610-88008',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600018',
    source: 'REFERRAL',
    tags: ['high-value', 'regular'],
    assignedTo: 'Meera Joshi',
    status: 'ACTIVE',
    notes: 'Pays on time and responds well to follow-up reminders.',
    avatar: initials('Maya Iyer'),
    linkedCustomerId: 'cus_9008',
    createdAt: isoAt(-190),
    updatedAt: isoAt(-13),
    lastContactedAt: isoAt(-12),
    anniversary: isoAt(-6000),
    customFields: { preferredChannel: 'Call', monthlyPotential: 42000 }
  },
  {
    id: 'crm-con-009',
    type: 'CUSTOMER',
    entityType: 'INDIVIDUAL',
    firstName: 'Arjun',
    lastName: 'Kulkarni',
    displayName: 'Arjun Kulkarni',
    company: 'Kulkarni Traders',
    email: 'arjun.kulkarni@example.com',
    phone: '+91-98713-99009',
    whatsapp: '+91-98713-99009',
    city: 'Nagpur',
    state: 'Maharashtra',
    pincode: '440001',
    source: 'COLD_CALL',
    tags: ['inactive', 'price-sensitive'],
    assignedTo: 'Rohit Kumar',
    status: 'INACTIVE',
    notes: 'Moved to a competitor last season; worth reactivation later.',
    avatar: initials('Arjun Kulkarni'),
    linkedCustomerId: 'cus_9009',
    createdAt: isoAt(-420),
    updatedAt: isoAt(-140),
    lastContactedAt: isoAt(-150),
    customFields: { lostTo: 'Local wholesaler', lastOrderValue: 11890 }
  },
  {
    id: 'crm-con-010',
    type: 'CUSTOMER',
    entityType: 'INDIVIDUAL',
    firstName: 'Pooja',
    lastName: 'Chawla',
    displayName: 'Pooja Chawla',
    company: 'Chawla Family Stores',
    designation: 'Owner',
    email: 'pooja.chawla@example.com',
    phone: '+91-98103-10010',
    whatsapp: '+91-98103-10010',
    city: 'Surat',
    state: 'Gujarat',
    pincode: '395003',
    source: 'REFERRAL',
    tags: ['repeat-buyer', 'garment'],
    assignedTo: 'Naman Arora',
    status: 'ACTIVE',
    notes: 'Strong seasonal buyer before festivals.',
    avatar: initials('Pooja Chawla'),
    linkedCustomerId: 'cus_9010',
    createdAt: isoAt(-300),
    updatedAt: isoAt(-20),
    lastContactedAt: isoAt(-18),
    birthday: isoAt(-11600),
    customFields: { preferredLanguage: 'Gujarati', creditLimit: 60000 }
  },
  {
    id: 'crm-con-011',
    type: 'CUSTOMER',
    entityType: 'INDIVIDUAL',
    firstName: 'Yash',
    lastName: 'Malhotra',
    displayName: 'Yash Malhotra',
    company: 'Malhotra Concepts',
    email: 'yash.malhotra@example.com',
    phone: '+91-98104-11011',
    whatsapp: '+91-98104-11011',
    city: 'Noida',
    state: 'Uttar Pradesh',
    pincode: '201301',
    source: 'WEBSITE',
    tags: ['new', 'quote-pending'],
    assignedTo: 'Meera Joshi',
    status: 'ACTIVE',
    notes: 'Needs a quote revision before closing.',
    avatar: initials('Yash Malhotra'),
    linkedCustomerId: 'cus_9011',
    createdAt: isoAt(-80),
    updatedAt: isoAt(-2),
    lastContactedAt: isoAt(-2),
    customFields: { preferredChannel: 'Email', expectedMonthlySpend: 18000 }
  },
  {
    id: 'crm-con-012',
    type: 'CUSTOMER',
    entityType: 'INDIVIDUAL',
    firstName: 'Ananya',
    lastName: 'Dutta',
    displayName: 'Ananya Dutta',
    company: 'Dutta Retail',
    designation: 'Procurement',
    email: 'ananya.dutta@example.com',
    phone: '+91-98330-12012',
    whatsapp: '+91-98330-12012',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700091',
    source: 'EXHIBITION',
    tags: ['active', 'credit'],
    assignedTo: 'Rohit Kumar',
    status: 'ACTIVE',
    notes: 'Orders consistently and asks for payment reminders.',
    avatar: initials('Ananya Dutta'),
    linkedCustomerId: 'cus_9012',
    createdAt: isoAt(-320),
    updatedAt: isoAt(-1),
    lastContactedAt: isoAt(-1),
    anniversary: isoAt(-4500),
    customFields: { preferredPaymentMode: 'Bank Transfer', outstandingBalance: 12450 }
  },
  {
    id: 'crm-con-013',
    type: 'LEAD',
    entityType: 'BUSINESS',
    firstName: 'Kavya',
    lastName: 'Sharma',
    displayName: 'Kavya Fashions',
    company: 'Kavya Fashions',
    designation: 'Founder',
    email: 'kavya@kavyafashions.in',
    phone: '+91-98720-13013',
    whatsapp: '+91-98720-13013',
    city: 'Ludhiana',
    state: 'Punjab',
    pincode: '141001',
    source: 'EXHIBITION',
    tags: ['hot', 'boutique'],
    assignedTo: 'Naman Arora',
    rating: 'HOT',
    status: 'ACTIVE',
    notes: 'Needs a fast quote for festive inventory.',
    avatar: initials('Kavya Fashions'),
    createdAt: isoAt(-32),
    updatedAt: isoAt(-1),
    lastContactedAt: isoAt(-1),
    customFields: { employeeCount: 12, expectedMonthlySpend: 90000 }
  },
  {
    id: 'crm-con-014',
    type: 'CUSTOMER',
    entityType: 'BUSINESS',
    firstName: 'Sapphire',
    lastName: 'Distributors',
    displayName: 'Sapphire Distributors',
    company: 'Sapphire Distributors',
    designation: 'Distributor',
    email: 'orders@sapphiredist.in',
    phone: '+91-79-4100-14014',
    whatsapp: '+91-79-4100-14014',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380009',
    gstin: '24AASFS1401Q1Z2',
    pan: 'AASFS1401Q',
    source: 'REFERRAL',
    tags: ['wholesale', 'b2b'],
    assignedTo: 'Meera Joshi',
    status: 'ACTIVE',
    notes: 'Large order sizes and predictable replenishment.',
    avatar: initials('Sapphire Distributors'),
    createdAt: isoAt(-240),
    updatedAt: isoAt(-6),
    lastContactedAt: isoAt(-6),
    customFields: { creditDays: 30, annualPotential: 600000 }
  },
  {
    id: 'crm-con-015',
    type: 'PARTNER',
    entityType: 'BUSINESS',
    firstName: 'NexGen',
    lastName: 'Interiors',
    displayName: 'NexGen Interiors',
    company: 'NexGen Interiors',
    designation: 'Channel Partner',
    email: 'hello@nexgeninteriors.in',
    phone: '+91-80-4400-15015',
    whatsapp: '+91-80-4400-15015',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560034',
    source: 'OTHER',
    tags: ['partner', 'design'],
    assignedTo: 'Rohit Kumar',
    status: 'ACTIVE',
    notes: 'Sends renovation leads and occasional bulk projects.',
    avatar: initials('NexGen Interiors'),
    createdAt: isoAt(-180),
    updatedAt: isoAt(-10),
    lastContactedAt: isoAt(-10),
    customFields: { partnerSince: '2025-09', referralFee: 3 }
  },
  {
    id: 'crm-con-016',
    type: 'CUSTOMER',
    entityType: 'BUSINESS',
    firstName: 'Harihar',
    lastName: 'Handlooms',
    displayName: 'Harihar Handlooms',
    company: 'Harihar Handlooms',
    email: 'sales@hariharhandlooms.in',
    phone: '+91-44-4100-16016',
    whatsapp: '+91-44-4100-16016',
    city: 'Madurai',
    state: 'Tamil Nadu',
    pincode: '625001',
    source: 'WALK_IN',
    tags: ['loom', 'fabric'],
    assignedTo: 'Naman Arora',
    status: 'ACTIVE',
    notes: 'Frequent small orders with seasonal spikes.',
    avatar: initials('Harihar Handlooms'),
    createdAt: isoAt(-260),
    updatedAt: isoAt(-8),
    lastContactedAt: isoAt(-8),
    customFields: { orderFrequency: 'Monthly', preferredChannel: 'Call' }
  },
  {
    id: 'crm-con-017',
    type: 'LEAD',
    entityType: 'BUSINESS',
    firstName: 'Milan',
    lastName: 'Garments',
    displayName: 'Milan Garments',
    company: 'Milan Garments',
    designation: 'Owner',
    email: 'milan.garments@gmail.com',
    phone: '+91-98724-17017',
    whatsapp: '+91-98724-17017',
    city: 'Indore',
    state: 'Madhya Pradesh',
    pincode: '452001',
    source: 'COLD_CALL',
    tags: ['cold', 'new'],
    assignedTo: 'Meera Joshi',
    rating: 'COLD',
    status: 'ACTIVE',
    notes: 'Interested in pricing but very slow to respond.',
    avatar: initials('Milan Garments'),
    createdAt: isoAt(-120),
    updatedAt: isoAt(-15),
    lastContactedAt: isoAt(-15),
    customFields: { expectedMonthlySpend: 30000 }
  },
  {
    id: 'crm-con-018',
    type: 'VENDOR',
    entityType: 'BUSINESS',
    firstName: 'Kamal',
    lastName: 'Traders',
    displayName: 'Kamal Traders',
    company: 'Kamal Traders',
    designation: 'Supplier',
    email: 'billing@kamaltraders.in',
    phone: '+91-261-4100-18018',
    whatsapp: '+91-261-4100-18018',
    city: 'Surat',
    state: 'Gujarat',
    pincode: '395002',
    source: 'REFERRAL',
    tags: ['supplier', 'raw-material'],
    assignedTo: 'Naman Arora',
    status: 'ACTIVE',
    notes: 'Fabric supplier with dependable delivery schedule.',
    avatar: initials('Kamal Traders'),
    createdAt: isoAt(-500),
    updatedAt: isoAt(-9),
    lastContactedAt: isoAt(-9),
    customFields: { vendorCode: 'V-014', paymentTermDays: 30 }
  },
  {
    id: 'crm-con-019',
    type: 'VENDOR',
    entityType: 'BUSINESS',
    firstName: 'Orchid',
    lastName: 'Packaging',
    displayName: 'Orchid Packaging',
    company: 'Orchid Packaging',
    designation: 'Supplier',
    email: 'support@orchidpackaging.in',
    phone: '+91-22-4100-19019',
    whatsapp: '+91-22-4100-19019',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400064',
    source: 'WEBSITE',
    tags: ['packaging', 'vendor'],
    assignedTo: 'Rohit Kumar',
    status: 'ACTIVE',
    notes: 'Provides branded packing material and labels.',
    avatar: initials('Orchid Packaging'),
    createdAt: isoAt(-430),
    updatedAt: isoAt(-14),
    lastContactedAt: isoAt(-14),
    customFields: { leadTimeDays: 5, minimumOrder: 10000 }
  },
  {
    id: 'crm-con-020',
    type: 'PARTNER',
    entityType: 'INDIVIDUAL',
    firstName: 'Asha',
    lastName: 'Consulting',
    displayName: 'Asha Consulting',
    company: 'Asha Consulting',
    designation: 'Advisor',
    email: 'asha.consulting@gmail.com',
    phone: '+91-98144-20020',
    whatsapp: '+91-98144-20020',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400050',
    source: 'REFERRAL',
    tags: ['partner', 'finance'],
    assignedTo: 'Meera Joshi',
    status: 'ACTIVE',
    notes: 'Helps with tax and finance advisory for SMB clients.',
    avatar: initials('Asha Consulting'),
    createdAt: isoAt(-340),
    updatedAt: isoAt(-16),
    lastContactedAt: isoAt(-16),
    customFields: { domain: 'Accountancy', retainer: 15000 }
  },
  {
    id: 'crm-con-021',
    type: 'LEAD',
    entityType: 'BUSINESS',
    firstName: 'Metro',
    lastName: 'Workwear',
    displayName: 'Metro Workwear',
    company: 'Metro Workwear',
    designation: 'Buying Manager',
    email: 'purchase@metroworkwear.in',
    phone: '+91-80-4100-21021',
    whatsapp: '+91-80-4100-21021',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560042',
    source: 'EXHIBITION',
    tags: ['hot', 'uniforms'],
    assignedTo: 'Naman Arora',
    rating: 'HOT',
    status: 'ACTIVE',
    notes: 'Quote requested for uniforms and embroidery work.',
    avatar: initials('Metro Workwear'),
    createdAt: isoAt(-18),
    updatedAt: isoAt(-1),
    lastContactedAt: isoAt(-1),
    customFields: { expectedMonthlySpend: 120000 }
  },
  {
    id: 'crm-con-022',
    type: 'CUSTOMER',
    entityType: 'BUSINESS',
    firstName: 'Sundar',
    lastName: 'Fabrics',
    displayName: 'Sundar Fabrics',
    company: 'Sundar Fabrics',
    email: 'orders@sundarfabrics.in',
    phone: '+91-44-4100-22022',
    whatsapp: '+91-44-4100-22022',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    pincode: '641001',
    source: 'WALK_IN',
    tags: ['customer', 'fabric'],
    assignedTo: 'Rohit Kumar',
    status: 'ACTIVE',
    notes: 'Consistent customer with regular fabric replenishment.',
    avatar: initials('Sundar Fabrics'),
    createdAt: isoAt(-420),
    updatedAt: isoAt(-12),
    lastContactedAt: isoAt(-12),
    customFields: { preferredLanguage: 'Tamil', creditLimit: 80000 }
  },
  {
    id: 'crm-con-023',
    type: 'LEAD',
    entityType: 'BUSINESS',
    firstName: 'Nivara',
    lastName: 'Homes',
    displayName: 'Nivara Homes',
    company: 'Nivara Homes',
    designation: 'Owner',
    email: 'hello@nivarahomes.in',
    phone: '+91-79-4100-23023',
    whatsapp: '+91-79-4100-23023',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380054',
    source: 'WEBSITE',
    tags: ['warm', 'home-decor'],
    assignedTo: 'Meera Joshi',
    rating: 'WARM',
    status: 'ACTIVE',
    notes: 'Needs samples and interior package pricing.',
    avatar: initials('Nivara Homes'),
    createdAt: isoAt(-27),
    updatedAt: isoAt(-3),
    lastContactedAt: isoAt(-3),
    customFields: { preferredChannel: 'Email', expectedMonthlySpend: 45000 }
  },
  {
    id: 'crm-con-024',
    type: 'CUSTOMER',
    entityType: 'BUSINESS',
    firstName: 'Pioneer',
    lastName: 'Metal Works',
    displayName: 'Pioneer Metal Works',
    company: 'Pioneer Metal Works',
    designation: 'Purchase Lead',
    email: 'purchases@pioneermetalworks.in',
    phone: '+91-22-4100-24024',
    whatsapp: '+91-22-4100-24024',
    city: 'Thane',
    state: 'Maharashtra',
    pincode: '400601',
    source: 'REFERRAL',
    tags: ['industrial', 'customer'],
    assignedTo: 'Naman Arora',
    status: 'ACTIVE',
    notes: 'Buys safety gear and packaging support materials.',
    avatar: initials('Pioneer Metal Works'),
    createdAt: isoAt(-470),
    updatedAt: isoAt(-21),
    lastContactedAt: isoAt(-21),
    customFields: { gstCategory: 'B2B', annualPotential: 300000 }
  }
]

export const crmDeals: Deal[] = [
  {
    id: 'crm-deal-001',
    title: 'Festival Season Kurti Replenishment',
    contactId: 'crm-con-001',
    value: 82000,
    currency: 'INR',
    stage: 'NEGOTIATION',
    probability: 70,
    expectedCloseDate: isoAt(6, 12),
    assignedTo: 'Naman Arora',
    productIds: ['prd_1006', 'prd_1008'],
    notes: 'Finalize fabric colours before the weekend.',
    source: 'WALK_IN',
    tags: ['seasonal', 'repeat'],
    activities: ['crm-act-001', 'crm-act-002'],
    createdAt: isoAt(-12),
    updatedAt: isoAt(-1)
  },
  {
    id: 'crm-deal-002',
    title: 'Bulk Workwear Quote',
    contactId: 'crm-con-021',
    value: 120000,
    currency: 'INR',
    stage: 'PROPOSAL',
    probability: 55,
    expectedCloseDate: isoAt(9, 12),
    assignedTo: 'Meera Joshi',
    productIds: ['prd_1001', 'prd_1008'],
    notes: 'Proposal sent with embroidery add-on.',
    source: 'EXHIBITION',
    tags: ['bulk', 'uniforms'],
    activities: ['crm-act-003'],
    createdAt: isoAt(-18),
    updatedAt: isoAt(-2)
  },
  {
    id: 'crm-deal-003',
    title: 'Office Decor Retainer',
    contactId: 'crm-con-008',
    value: 54000,
    currency: 'INR',
    stage: 'CLOSED_WON',
    probability: 100,
    expectedCloseDate: isoAt(-3, 12),
    actualCloseDate: isoAt(-3, 12),
    assignedTo: 'Rohit Kumar',
    productIds: ['prd_1004', 'prd_1006'],
    notes: 'Won after sample approval.',
    source: 'REFERRAL',
    tags: ['won', 'repeat'],
    activities: ['crm-act-005', 'crm-act-006'],
    createdAt: isoAt(-28),
    updatedAt: isoAt(-3)
  },
  {
    id: 'crm-deal-004',
    title: 'Distributor Reorder Q2',
    contactId: 'crm-con-014',
    value: 245000,
    currency: 'INR',
    stage: 'QUALIFIED',
    probability: 40,
    expectedCloseDate: isoAt(14, 12),
    assignedTo: 'Meera Joshi',
    productIds: ['prd_1001', 'prd_1005', 'prd_1008'],
    notes: 'Requested tax-inclusive pricing and transport support.',
    source: 'REFERRAL',
    tags: ['wholesale'],
    activities: ['crm-act-007'],
    createdAt: isoAt(-20),
    updatedAt: isoAt(-4)
  },
  {
    id: 'crm-deal-005',
    title: 'Premium Styling Studio Reorder',
    contactId: 'crm-con-002',
    value: 67000,
    currency: 'INR',
    stage: 'PROPOSAL',
    probability: 60,
    expectedCloseDate: isoAt(8, 12),
    assignedTo: 'Naman Arora',
    productIds: ['prd_1005', 'prd_1006'],
    notes: 'Proposal includes sample kit and rush delivery.',
    source: 'REFERRAL',
    tags: ['premium'],
    activities: ['crm-act-008'],
    createdAt: isoAt(-11),
    updatedAt: isoAt(-1)
  },
  {
    id: 'crm-deal-006',
    title: 'Lapsed Account Reactivation',
    contactId: 'crm-con-005',
    value: 28000,
    currency: 'INR',
    stage: 'CLOSED_LOST',
    probability: 0,
    expectedCloseDate: isoAt(-24, 12),
    actualCloseDate: isoAt(-24, 12),
    assignedTo: 'Rohit Kumar',
    productIds: ['prd_1002'],
    notes: 'Customer delayed decision too long.',
    lostReason: 'Chose a lower-cost local supplier.',
    source: 'REFERRAL',
    tags: ['reactivation'],
    activities: ['crm-act-009'],
    createdAt: isoAt(-31),
    updatedAt: isoAt(-24)
  },
  {
    id: 'crm-deal-007',
    title: 'Home Decor Expansion',
    contactId: 'crm-con-023',
    value: 45000,
    currency: 'INR',
    stage: 'LEAD',
    probability: 18,
    expectedCloseDate: isoAt(16, 12),
    assignedTo: 'Meera Joshi',
    productIds: ['prd_1004', 'prd_1006'],
    notes: 'Sample catalog shared on email.',
    source: 'WEBSITE',
    tags: ['warm'],
    activities: ['crm-act-010'],
    createdAt: isoAt(-7),
    updatedAt: isoAt(-1)
  },
  {
    id: 'crm-deal-008',
    title: 'Fabric Supplier Annual Contract',
    contactId: 'crm-con-016',
    value: 185000,
    currency: 'INR',
    stage: 'NEGOTIATION',
    probability: 68,
    expectedCloseDate: isoAt(11, 12),
    assignedTo: 'Naman Arora',
    productIds: ['prd_1001', 'prd_1008'],
    notes: 'Negotiating dispatch cadence and payment terms.',
    source: 'WALK_IN',
    tags: ['contract'],
    activities: ['crm-act-011'],
    createdAt: isoAt(-14),
    updatedAt: isoAt(-2)
  }
]

export const crmActivities: Activity[] = [
  {
    id: 'crm-act-001',
    type: 'CALL',
    contactId: 'crm-con-001',
    dealId: 'crm-deal-001',
    subject: 'Follow up on festive fabric quote',
    description: 'Discussed quantities and delivery window.',
    outcome: 'Customer asked for a revised quote by tomorrow.',
    scheduledAt: isoAt(-1, 11),
    completedAt: isoAt(-1, 11),
    duration: 18,
    status: 'COMPLETED',
    createdBy: 'Naman Arora',
    reminder: 30,
    attachments: []
  },
  {
    id: 'crm-act-002',
    type: 'WHATSAPP',
    contactId: 'crm-con-001',
    dealId: 'crm-deal-001',
    subject: 'Send fabric colour options',
    description: 'Shared catalogue and fabric swatches over WhatsApp.',
    outcome: 'Customer viewed the catalog and replied with two preferred colours.',
    scheduledAt: isoAt(-1, 14),
    completedAt: isoAt(-1, 14),
    status: 'COMPLETED',
    createdBy: 'Naman Arora',
    reminder: 15,
    attachments: ['catalogue.pdf']
  },
  {
    id: 'crm-act-003',
    type: 'EMAIL',
    contactId: 'crm-con-021',
    dealId: 'crm-deal-002',
    subject: 'Send workwear proposal',
    description: 'Proposal with size chart and embroidery pricing.',
    outcome: 'Waiting for procurement review.',
    scheduledAt: isoAt(-2, 10),
    completedAt: isoAt(-2, 10),
    status: 'COMPLETED',
    createdBy: 'Meera Joshi',
    reminder: 60,
    attachments: ['proposal.pdf']
  },
  {
    id: 'crm-act-004',
    type: 'FOLLOW_UP',
    contactId: 'crm-con-021',
    dealId: 'crm-deal-002',
    subject: 'Check quote feedback',
    description: 'Call the buying manager for comments on the proposal.',
    scheduledAt: isoAt(0, 17),
    status: 'SCHEDULED',
    createdBy: 'Meera Joshi',
    reminder: 120,
    attachments: []
  },
  {
    id: 'crm-act-005',
    type: 'MEETING',
    contactId: 'crm-con-008',
    dealId: 'crm-deal-003',
    subject: 'Sample review meeting',
    description: 'Reviewed decor samples at the client site.',
    outcome: 'Samples approved and order confirmed.',
    scheduledAt: isoAt(-5, 13),
    completedAt: isoAt(-5, 13),
    duration: 42,
    status: 'COMPLETED',
    createdBy: 'Rohit Kumar',
    reminder: 60,
    attachments: ['sample-board.jpg']
  },
  {
    id: 'crm-act-006',
    type: 'NOTE',
    contactId: 'crm-con-008',
    dealId: 'crm-deal-003',
    subject: 'Win reason',
    description: 'Great response to quick turnaround and after-sales support.',
    outcome: 'Documented for future reference.',
    completedAt: isoAt(-3, 12),
    status: 'COMPLETED',
    createdBy: 'Rohit Kumar',
    reminder: 0,
    attachments: []
  },
  {
    id: 'crm-act-007',
    type: 'SITE_VISIT',
    contactId: 'crm-con-014',
    dealId: 'crm-deal-004',
    subject: 'Warehouse visit',
    description: 'Visited warehouse to understand replenishment flow.',
    outcome: 'Confirmed dispatch and packing requirements.',
    scheduledAt: isoAt(-4, 15),
    completedAt: isoAt(-4, 15),
    duration: 55,
    status: 'COMPLETED',
    createdBy: 'Meera Joshi',
    reminder: 180,
    attachments: []
  },
  {
    id: 'crm-act-008',
    type: 'DEMO',
    contactId: 'crm-con-002',
    dealId: 'crm-deal-005',
    subject: 'Sample showcase',
    description: 'Presented premium variants and packaging options.',
    scheduledAt: isoAt(1, 16),
    status: 'SCHEDULED',
    createdBy: 'Naman Arora',
    reminder: 60,
    attachments: ['sample-kit.zip']
  },
  {
    id: 'crm-act-009',
    type: 'CALL',
    contactId: 'crm-con-005',
    dealId: 'crm-deal-006',
    subject: 'Reactivation call',
    description: 'Tried to revive the inactive account.',
    outcome: 'Customer is not ready to switch suppliers.',
    completedAt: isoAt(-24, 11),
    duration: 9,
    status: 'COMPLETED',
    createdBy: 'Rohit Kumar',
    reminder: 30,
    attachments: []
  },
  {
    id: 'crm-act-010',
    type: 'EMAIL',
    contactId: 'crm-con-023',
    dealId: 'crm-deal-007',
    subject: 'Send home decor brochure',
    description: 'Shared catalog with starter package pricing.',
    scheduledAt: isoAt(0, 12),
    status: 'SCHEDULED',
    createdBy: 'Meera Joshi',
    reminder: 45,
    attachments: ['brochure.pdf']
  },
  {
    id: 'crm-act-011',
    type: 'MEETING',
    contactId: 'crm-con-016',
    dealId: 'crm-deal-008',
    subject: 'Contract negotiation meeting',
    description: 'Discussed volume slabs and advance payment.',
    scheduledAt: isoAt(2, 15),
    status: 'SCHEDULED',
    createdBy: 'Naman Arora',
    reminder: 90,
    attachments: []
  },
  {
    id: 'crm-act-012',
    type: 'TASK',
    contactId: 'crm-con-010',
    subject: 'Check payment reminder',
    description: 'Send a polite reminder for the pending statement.',
    scheduledAt: isoAt(-1, 10),
    status: 'SCHEDULED',
    createdBy: 'Meera Joshi',
    reminder: 30,
    attachments: []
  },
  {
    id: 'crm-act-013',
    type: 'WHATSAPP',
    contactId: 'crm-con-011',
    subject: 'Share revised quote',
    description: 'Sent the revised quote to the procurement team.',
    completedAt: isoAt(-2, 19),
    status: 'COMPLETED',
    createdBy: 'Rohit Kumar',
    reminder: 15,
    attachments: ['quote-v2.pdf']
  },
  {
    id: 'crm-act-014',
    type: 'CALL',
    contactId: 'crm-con-017',
    subject: 'Cold lead nudge',
    description: 'Called the owner after exhibition follow-up.',
    scheduledAt: isoAt(1, 11),
    status: 'SCHEDULED',
    createdBy: 'Naman Arora',
    reminder: 45,
    attachments: []
  },
  {
    id: 'crm-act-015',
    type: 'NOTE',
    contactId: 'crm-con-018',
    subject: 'Vendor quality note',
    description: 'Fabric quality remains stable this quarter.',
    completedAt: isoAt(-10, 9),
    status: 'COMPLETED',
    createdBy: 'Meera Joshi',
    reminder: 0,
    attachments: []
  },
  {
    id: 'crm-act-016',
    type: 'FOLLOW_UP',
    contactId: 'crm-con-024',
    subject: 'Quarterly replenishment follow-up',
    description: 'Check if the next purchase order is due.',
    scheduledAt: isoAt(0, 18),
    status: 'SCHEDULED',
    createdBy: 'Rohit Kumar',
    reminder: 60,
    attachments: []
  }
]

export const crmSegments: Segment[] = [
  {
    id: 'crm-seg-001',
    name: 'High Value Customers',
    description: 'Customers with higher purchase value in the last season.',
    type: 'DYNAMIC',
    conditions: [
      { field: 'totalSpent', operator: 'GREATER_THAN', value: 50000 }
    ],
    contactIds: [],
    color: '#2563eb',
    createdAt: isoAt(-20),
    updatedAt: isoAt(-2)
  },
  {
    id: 'crm-seg-002',
    name: 'Inactive Customers',
    description: 'Customers who have not purchased in more than 90 days.',
    type: 'DYNAMIC',
    conditions: [
      { field: 'type', operator: 'EQUALS', value: 'CUSTOMER' },
      { field: 'lastPurchaseDate', operator: 'OLDER_THAN_DAYS', value: 90 }
    ],
    contactIds: [],
    color: '#64748b',
    createdAt: isoAt(-35),
    updatedAt: isoAt(-5)
  },
  {
    id: 'crm-seg-003',
    name: 'Hot Leads',
    description: 'Leads that are rated hot and need immediate follow-up.',
    type: 'DYNAMIC',
    conditionLogic: 'AND',
    conditions: [
      { field: 'type', operator: 'EQUALS', value: 'LEAD' },
      { field: 'rating', operator: 'EQUALS', value: 'HOT' }
    ],
    contactIds: [],
    color: '#f59e0b',
    createdAt: isoAt(-28),
    updatedAt: isoAt(-1)
  },
  {
    id: 'crm-seg-004',
    name: 'Mumbai Customers',
    description: 'Contacts based in Mumbai for local follow-up and campaigns.',
    type: 'DYNAMIC',
    conditions: [
      { field: 'city', operator: 'EQUALS', value: 'Mumbai' }
    ],
    contactIds: [],
    color: '#10b981',
    createdAt: isoAt(-18),
    updatedAt: isoAt(-1)
  },
  {
    id: 'crm-seg-005',
    name: 'Recent Sign-ups',
    description: 'Contacts created in the last 30 days.',
    type: 'DYNAMIC',
    conditions: [
      { field: 'createdAt', operator: 'IN_LAST_DAYS', value: 30 }
    ],
    contactIds: [],
    color: '#8b5cf6',
    createdAt: isoAt(-10),
    updatedAt: isoAt(-1)
  },
  {
    id: 'crm-seg-006',
    name: 'Wholesale Accounts',
    description: 'Static segment for key B2B buyers.',
    type: 'STATIC',
    conditions: [],
    contactIds: ['crm-con-014', 'crm-con-016', 'crm-con-022', 'crm-con-024'],
    color: '#2563eb',
    createdAt: isoAt(-28),
    updatedAt: isoAt(-6)
  }
]

export const crmCampaigns: Campaign[] = [
  {
    id: 'crm-camp-001',
    name: 'Festival Reconnect',
    type: 'WHATSAPP',
    segmentId: 'crm-seg-002',
    status: 'ACTIVE',
    startDate: isoAt(-3),
    endDate: isoAt(4),
    message: 'Festival offer is live. Reply for a fresh quote and same-week dispatch.',
    contactCount: 8,
    respondedCount: 3,
    convertedCount: 1,
    notes: 'Focused on dormant customers with prior buying history.',
    createdAt: isoAt(-4),
    updatedAt: isoAt(-1)
  },
  {
    id: 'crm-camp-002',
    name: 'Workwear Bulk Push',
    type: 'EMAIL',
    segmentId: 'crm-seg-003',
    status: 'DRAFT',
    message: 'Bulk workwear pricing and sample options are ready for review.',
    contactCount: 4,
    respondedCount: 0,
    convertedCount: 0,
    notes: 'Send after proposal is approved.',
    createdAt: isoAt(-2),
    updatedAt: isoAt(-2)
  },
  {
    id: 'crm-camp-003',
    name: 'Payment Reminder Wave',
    type: 'SMS',
    segmentId: 'crm-seg-001',
    status: 'ACTIVE',
    startDate: isoAt(-1),
    endDate: isoAt(2),
    message: 'Friendly reminder that your outstanding balance is due soon.',
    contactCount: 5,
    respondedCount: 2,
    convertedCount: 1,
    notes: 'Keep tone polite and short.',
    createdAt: isoAt(-1),
    updatedAt: isoAt(-1)
  },
  {
    id: 'crm-camp-004',
    name: 'Quarterly Check-in Calls',
    type: 'CALL',
    status: 'COMPLETED',
    startDate: isoAt(-15),
    endDate: isoAt(-9),
    message: 'Check-in call for repeat buyers before quarter close.',
    contactCount: 6,
    respondedCount: 5,
    convertedCount: 2,
    notes: 'Completed with strong response from existing buyers.',
    createdAt: isoAt(-16),
    updatedAt: isoAt(-9)
  }
]

export const crmSettings: CRMSettings = {
  defaultAssignee: 'Naman Arora',
  dealStages: ['LEAD', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'],
  leadSources: ['WALK_IN', 'REFERRAL', 'WEBSITE', 'SOCIAL_MEDIA', 'COLD_CALL', 'EXHIBITION', 'OTHER'],
  customContactFields: ['preferredLanguage', 'preferredChannel', 'monthlyPotential', 'creditLimit', 'annualPotential', 'outstandingBalance'],
  reminderDefaults: {
    call: 30,
    meeting: 60,
    followUp: 120
  },
  enableBirthdayReminders: true,
  enableFollowUpAlerts: true
}
