import type { Contact } from '@/data/crm'

export type ContactIdentity = {
  crmContactId?: string | null
  linkedCustomerId?: string | null
  name?: string | null
  company?: string | null
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  altPhone?: string | null
}

export const normalizeText = (value: string | undefined | null): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

export const normalizeDigits = (value: string | undefined | null): string => String(value ?? '').replace(/\D/g, '')

export const splitName = (
  value: string | undefined | null,
): {
  firstName: string
  lastName: string
  displayName: string
} => {
  const displayName = String(value ?? '').trim()
  const parts = displayName.split(/\s+/).filter(Boolean)
  if (!parts.length) {
    return { firstName: 'Customer', lastName: '', displayName: 'Customer' }
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '', displayName }
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
    displayName
  }
}

export const contactMatchesIdentity = (contact: Contact, identity: ContactIdentity): boolean => {
  if (identity.crmContactId && contact.id === identity.crmContactId) return true
  if (identity.linkedCustomerId && contact.linkedCustomerId && contact.linkedCustomerId === identity.linkedCustomerId) return true

  const names = [contact.displayName, contact.company, `${contact.firstName} ${contact.lastName}`]
    .map(normalizeText)
    .filter(Boolean)
  const identityName = normalizeText(identity.name)
  const identityCompany = normalizeText(identity.company)
  const contactEmail = normalizeText(contact.email)
  const identityEmail = normalizeText(identity.email)
  const contactPhones = [contact.phone, contact.whatsapp, contact.altPhone].map(normalizeDigits).filter(Boolean)
  const identityPhones = [identity.phone, identity.whatsapp, identity.altPhone].map(normalizeDigits).filter(Boolean)

  if (identityEmail && contactEmail && identityEmail === contactEmail) return true
  if (identityPhones.some((phone) => contactPhones.includes(phone))) return true
  if (identityName && names.includes(identityName)) return true
  if (identityCompany && names.includes(identityCompany)) return true

  return false
}

export const findBestContactMatch = (contacts: Contact[], identity: ContactIdentity): Contact | undefined => {
  return contacts.find((contact) => contactMatchesIdentity(contact, identity))
}
