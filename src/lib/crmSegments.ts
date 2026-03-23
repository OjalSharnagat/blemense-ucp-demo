import type { Contact, CustomContactField, SegmentCondition, SegmentOperator } from '@/data/crm'

export type SegmentLogic = 'AND' | 'OR'
export type SegmentFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'tags'
export type SegmentMetrics = {
  totalSpent: number
  lastPurchaseDate?: string
  purchaseCount: number
}

export type SegmentFieldOption = {
  value: SegmentCondition['field']
  label: string
  group: string
  type: SegmentFieldType
}

const CORE_GROUP = 'Core fields'
const DERIVED_GROUP = 'Derived metrics'
const CUSTOM_GROUP = 'Custom fields'

const FIELD_CATALOG: Array<SegmentFieldOption & { optionKey: string }> = [
  { optionKey: 'type', value: 'type', label: 'Type', group: CORE_GROUP, type: 'select' },
  { optionKey: 'entityType', value: 'entityType', label: 'Entity type', group: CORE_GROUP, type: 'select' },
  { optionKey: 'firstName', value: 'firstName', label: 'First name', group: CORE_GROUP, type: 'text' },
  { optionKey: 'lastName', value: 'lastName', label: 'Last name', group: CORE_GROUP, type: 'text' },
  { optionKey: 'displayName', value: 'displayName', label: 'Display name', group: CORE_GROUP, type: 'text' },
  { optionKey: 'company', value: 'company', label: 'Company', group: CORE_GROUP, type: 'text' },
  { optionKey: 'designation', value: 'designation', label: 'Designation', group: CORE_GROUP, type: 'text' },
  { optionKey: 'email', value: 'email', label: 'Email', group: CORE_GROUP, type: 'text' },
  { optionKey: 'phone', value: 'phone', label: 'Phone', group: CORE_GROUP, type: 'text' },
  { optionKey: 'altPhone', value: 'altPhone', label: 'Alt phone', group: CORE_GROUP, type: 'text' },
  { optionKey: 'whatsapp', value: 'whatsapp', label: 'WhatsApp', group: CORE_GROUP, type: 'text' },
  { optionKey: 'address', value: 'address', label: 'Address', group: CORE_GROUP, type: 'text' },
  { optionKey: 'city', value: 'city', label: 'City', group: CORE_GROUP, type: 'text' },
  { optionKey: 'state', value: 'state', label: 'State', group: CORE_GROUP, type: 'text' },
  { optionKey: 'pincode', value: 'pincode', label: 'Pincode', group: CORE_GROUP, type: 'text' },
  { optionKey: 'gstin', value: 'gstin', label: 'GSTIN', group: CORE_GROUP, type: 'text' },
  { optionKey: 'pan', value: 'pan', label: 'PAN', group: CORE_GROUP, type: 'text' },
  { optionKey: 'source', value: 'source', label: 'Source', group: CORE_GROUP, type: 'select' },
  { optionKey: 'tags', value: 'tags', label: 'Tags', group: CORE_GROUP, type: 'tags' },
  { optionKey: 'assignedTo', value: 'assignedTo', label: 'Assigned to', group: CORE_GROUP, type: 'select' },
  { optionKey: 'rating', value: 'rating', label: 'Rating', group: CORE_GROUP, type: 'select' },
  { optionKey: 'status', value: 'status', label: 'Status', group: CORE_GROUP, type: 'select' },
  { optionKey: 'notes', value: 'notes', label: 'Notes', group: CORE_GROUP, type: 'text' },
  { optionKey: 'linkedCustomerId', value: 'linkedCustomerId', label: 'Linked customer', group: CORE_GROUP, type: 'text' },
  { optionKey: 'createdAt', value: 'createdAt', label: 'Created date', group: CORE_GROUP, type: 'date' },
  { optionKey: 'updatedAt', value: 'updatedAt', label: 'Updated date', group: CORE_GROUP, type: 'date' },
  { optionKey: 'lastContactedAt', value: 'lastContactedAt', label: 'Last contacted', group: CORE_GROUP, type: 'date' },
  { optionKey: 'birthday', value: 'birthday', label: 'Birthday', group: CORE_GROUP, type: 'date' },
  { optionKey: 'anniversary', value: 'anniversary', label: 'Anniversary', group: CORE_GROUP, type: 'date' },
  { optionKey: 'score', value: 'score', label: 'CRM score', group: DERIVED_GROUP, type: 'number' },
  { optionKey: 'totalSpent', value: 'totalSpent', label: 'Total spent', group: DERIVED_GROUP, type: 'number' },
  { optionKey: 'lastPurchaseDate', value: 'lastPurchaseDate', label: 'Last purchase date', group: DERIVED_GROUP, type: 'date' }
]

const TEXT_OPERATORS: Array<{ value: SegmentOperator; label: string }> = [
  { value: 'EQUALS', label: 'Equals' },
  { value: 'NOT_EQUALS', label: 'Does not equal' },
  { value: 'CONTAINS', label: 'Contains' },
  { value: 'IS_EMPTY', label: 'Is empty' }
]

const NUMBER_OPERATORS: Array<{ value: SegmentOperator; label: string }> = [
  { value: 'EQUALS', label: 'Equals' },
  { value: 'NOT_EQUALS', label: 'Does not equal' },
  { value: 'GREATER_THAN', label: 'Greater than' },
  { value: 'LESS_THAN', label: 'Less than' },
  { value: 'IS_EMPTY', label: 'Is empty' }
]

const DATE_OPERATORS: Array<{ value: SegmentOperator; label: string }> = [
  { value: 'ON', label: 'On' },
  { value: 'BEFORE_DATE', label: 'Before date' },
  { value: 'AFTER_DATE', label: 'After date' },
  { value: 'IN_LAST_DAYS', label: 'In last N days' },
  { value: 'OLDER_THAN_DAYS', label: 'Older than N days' },
  { value: 'IS_EMPTY', label: 'Is empty' }
]

const SELECT_OPERATORS: Array<{ value: SegmentOperator; label: string }> = [
  { value: 'EQUALS', label: 'Equals' },
  { value: 'NOT_EQUALS', label: 'Does not equal' },
  { value: 'CONTAINS', label: 'Contains' },
  { value: 'IS_EMPTY', label: 'Is empty' }
]

const BOOLEAN_OPERATORS: Array<{ value: SegmentOperator; label: string }> = [
  { value: 'EQUALS', label: 'Is' },
  { value: 'NOT_EQUALS', label: 'Is not' }
]

const DATE_FIELDS = new Set<SegmentCondition['field']>(['createdAt', 'updatedAt', 'lastContactedAt', 'birthday', 'anniversary', 'lastPurchaseDate'])
const NUMBER_FIELDS = new Set<SegmentCondition['field']>(['score', 'totalSpent'])
const SELECT_FIELDS = new Set<SegmentCondition['field']>(['type', 'entityType', 'source', 'assignedTo', 'rating', 'status'])
const BOOLEAN_FIELDS = new Set<SegmentCondition['field']>([])
const TAG_FIELDS = new Set<SegmentCondition['field']>(['tags'])

const normalize = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const toDate = (value: unknown): Date | null => {
  if (value === null || value === undefined || value === '') return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

const customFieldTypeToSegmentType = (type: CustomContactField['type']): SegmentFieldType =>
  type === 'NUMBER' ? 'number' : type === 'DATE' ? 'date' : type === 'DROPDOWN' ? 'select' : type === 'CHECKBOX' ? 'boolean' : 'text'

export function getSegmentFieldOptions(customFields: CustomContactField[]): SegmentFieldOption[] {
  const customOptions = customFields.map((field) => ({
    value: `customFields.${field.id}` as const,
    label: field.label,
    group: CUSTOM_GROUP,
    type: customFieldTypeToSegmentType(field.type)
  }))

  return [...FIELD_CATALOG, ...customOptions]
}

export function getSegmentFieldMeta(field: SegmentCondition['field'], customFields: CustomContactField[]): SegmentFieldOption {
  const options = getSegmentFieldOptions(customFields)
  return options.find((option) => option.value === field) ?? { value: field, label: String(field), group: CUSTOM_GROUP, type: 'text' }
}

export function getSegmentFieldType(field: SegmentCondition['field'], customFields: CustomContactField[]): SegmentFieldType {
  return getSegmentFieldMeta(field, customFields).type
}

export function getSegmentOperators(fieldType: SegmentFieldType): Array<{ value: SegmentOperator; label: string }> {
  switch (fieldType) {
    case 'number':
      return NUMBER_OPERATORS
    case 'date':
      return DATE_OPERATORS
    case 'select':
      return SELECT_OPERATORS
    case 'boolean':
      return BOOLEAN_OPERATORS
    case 'tags':
      return SELECT_OPERATORS
    case 'text':
    default:
      return TEXT_OPERATORS
  }
}

export function getSegmentFieldValue(contact: Contact, field: SegmentCondition['field'], metrics: SegmentMetrics): unknown {
  if (field === 'score') return 0
  if (field === 'totalSpent') return metrics.totalSpent
  if (field === 'lastPurchaseDate') return metrics.lastPurchaseDate
  if (field.startsWith('customFields.')) {
    const key = field.replace('customFields.', '')
    return contact.customFields[key]
  }
  return contact[field as keyof Contact] as unknown
}

export function evaluateSegmentCondition(
  contact: Contact,
  condition: SegmentCondition,
  score: number,
  metrics: SegmentMetrics
): boolean {
  const fieldType = NUMBER_FIELDS.has(condition.field)
    ? 'number'
    : DATE_FIELDS.has(condition.field)
      ? 'date'
      : TAG_FIELDS.has(condition.field)
        ? 'tags'
        : SELECT_FIELDS.has(condition.field)
          ? 'select'
          : BOOLEAN_FIELDS.has(condition.field)
            ? 'boolean'
            : 'text'

  const value = getSegmentFieldValue(contact, condition.field, metrics)

  switch (condition.field) {
    case 'score': {
      const threshold = Number(condition.value ?? 0)
      if (condition.operator === 'GREATER_THAN') return score > threshold
      if (condition.operator === 'LESS_THAN') return score < threshold
      if (condition.operator === 'EQUALS') return score === threshold
      if (condition.operator === 'NOT_EQUALS') return score !== threshold
      if (condition.operator === 'IS_EMPTY') return false
      return false
    }
    case 'totalSpent': {
      const threshold = Number(condition.value ?? 0)
      if (condition.operator === 'GREATER_THAN') return metrics.totalSpent > threshold
      if (condition.operator === 'LESS_THAN') return metrics.totalSpent < threshold
      if (condition.operator === 'EQUALS') return metrics.totalSpent === threshold
      if (condition.operator === 'NOT_EQUALS') return metrics.totalSpent !== threshold
      if (condition.operator === 'IS_EMPTY') return metrics.totalSpent === 0
      return false
    }
    case 'lastPurchaseDate': {
      const date = toDate(value)
      if (condition.operator === 'IS_EMPTY') return !date
      if (!date) return false
      const comparison = condition.value ? toDate(condition.value) : null
      const windowDays = Number(condition.value ?? 0)
      const threshold = new Date()
      threshold.setDate(threshold.getDate() - windowDays)

      if (condition.operator === 'IN_LAST_DAYS') return date.getTime() >= threshold.getTime()
      if (condition.operator === 'OLDER_THAN_DAYS') return date.getTime() < threshold.getTime()
      if (condition.operator === 'BEFORE_DATE') return comparison ? date.getTime() < comparison.getTime() : false
      if (condition.operator === 'AFTER_DATE') return comparison ? date.getTime() > comparison.getTime() : false
      if (condition.operator === 'ON') return comparison ? date.toDateString() === comparison.toDateString() : false
      if (condition.operator === 'EQUALS') return comparison ? date.getTime() === comparison.getTime() : false
      if (condition.operator === 'NOT_EQUALS') return comparison ? date.getTime() !== comparison.getTime() : false
      return false
    }
    default:
      break
  }

  if (fieldType === 'date') {
    const date = toDate(value)
    if (condition.operator === 'IS_EMPTY') return !date
    if (!date) return false
    const comparison = condition.value ? toDate(condition.value) : null
    const threshold = new Date()
    const windowDays = Number(condition.value ?? 0)
    threshold.setDate(threshold.getDate() - windowDays)

    switch (condition.operator) {
      case 'IN_LAST_DAYS':
        return date.getTime() >= threshold.getTime()
      case 'OLDER_THAN_DAYS':
        return date.getTime() < threshold.getTime()
      case 'BEFORE_DATE':
        return comparison ? date.getTime() < comparison.getTime() : false
      case 'AFTER_DATE':
        return comparison ? date.getTime() > comparison.getTime() : false
      case 'ON':
        return comparison ? date.toDateString() === comparison.toDateString() : false
      case 'EQUALS':
        return comparison ? date.getTime() === comparison.getTime() : false
      case 'NOT_EQUALS':
        return comparison ? date.getTime() !== comparison.getTime() : false
      default:
        return false
    }
  }

  if (fieldType === 'number') {
    const numericValue = Number(value ?? 0)
    const threshold = Number(condition.value ?? 0)
    if (condition.operator === 'IS_EMPTY') return Number.isNaN(numericValue) || numericValue === 0
    if (condition.operator === 'EQUALS') return numericValue === threshold
    if (condition.operator === 'NOT_EQUALS') return numericValue !== threshold
    if (condition.operator === 'GREATER_THAN') return numericValue > threshold
    if (condition.operator === 'LESS_THAN') return numericValue < threshold
    return false
  }

  if (fieldType === 'boolean') {
    const booleanValue = Boolean(value)
    const expected = condition.value === true || condition.value === 'true'
    if (condition.operator === 'EQUALS') return booleanValue === expected
    if (condition.operator === 'NOT_EQUALS') return booleanValue !== expected
    return false
  }

  const normalizedValue = Array.isArray(value)
    ? value.map((entry) => normalize(entry)).filter(Boolean)
    : normalize(value)
  const normalizedCondition = normalize(condition.value)

  if (condition.operator === 'IS_EMPTY') {
    return Array.isArray(value) ? value.length === 0 : !normalizedValue
  }

  if (Array.isArray(value)) {
    if (condition.operator === 'CONTAINS') {
      return value.some((entry) => normalize(entry).includes(normalizedCondition))
    }
    if (condition.operator === 'EQUALS') {
      return value.some((entry) => normalize(entry) === normalizedCondition)
    }
    if (condition.operator === 'NOT_EQUALS') {
      return !value.some((entry) => normalize(entry) === normalizedCondition)
    }
  }

  if (condition.operator === 'CONTAINS') return normalizedValue.includes(normalizedCondition)
  if (condition.operator === 'EQUALS') return normalizedValue === normalizedCondition
  if (condition.operator === 'NOT_EQUALS') return normalizedValue !== normalizedCondition

  return false
}

export function evaluateSegmentConditions(
  contact: Contact,
  conditions: SegmentCondition[],
  logic: SegmentLogic | undefined,
  score: number,
  metrics: SegmentMetrics
): boolean {
  if (!conditions.length) return true
  const results = conditions.map((condition) => evaluateSegmentCondition(contact, condition, score, metrics))
  return (logic ?? 'AND') === 'OR' ? results.some(Boolean) : results.every(Boolean)
}
