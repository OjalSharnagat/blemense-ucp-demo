import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { useCRMStore } from '@/lib/crmStore'
import { useAdminStore } from '@/lib/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { panelClassName, getContactInitials } from './shared'

type FormState = {
  type: 'CUSTOMER' | 'LEAD' | 'VENDOR' | 'PARTNER'
  entityType: 'INDIVIDUAL' | 'BUSINESS'
  firstName: string
  lastName: string
  company: string
  designation: string
  displayName: string
  email: string
  phone: string
  whatsapp: string
  city: string
  state: string
  pincode: string
  source: 'WALK_IN' | 'REFERRAL' | 'WEBSITE' | 'SOCIAL_MEDIA' | 'COLD_CALL' | 'EXHIBITION' | 'OTHER'
  assignedTo: string
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED'
  rating: 'HOT' | 'WARM' | 'COLD'
  tags: string
  notes: string
  linkedCustomerId: string
}

const initialState: FormState = {
  type: 'CUSTOMER',
  entityType: 'INDIVIDUAL',
  firstName: '',
  lastName: '',
  company: '',
  designation: '',
  displayName: '',
  email: '',
  phone: '',
  whatsapp: '',
  city: '',
  state: '',
  pincode: '',
  source: 'WALK_IN',
  assignedTo: 'Naman Arora',
  status: 'ACTIVE',
  rating: 'WARM',
  tags: '',
  notes: '',
  linkedCustomerId: ''
}

export default function ContactForm() {
  const navigate = useNavigate()
  const { createContact, settings } = useCRMStore()
  const { customers } = useAdminStore()
  const [form, setForm] = useState<FormState>(initialState)

  const computedDisplayName = useMemo(() => {
    if (form.displayName.trim()) return form.displayName.trim()
    if (form.entityType === 'BUSINESS' && form.company.trim()) return form.company.trim()
    return [form.firstName, form.lastName].filter(Boolean).join(' ').trim()
  }, [form.company, form.displayName, form.entityType, form.firstName, form.lastName])

  const initials = getContactInitials(computedDisplayName || 'New Contact')

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const contact = createContact({
      type: form.type,
      entityType: form.entityType,
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      displayName: computedDisplayName,
      company: form.company.trim() || undefined,
      designation: form.designation.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      whatsapp: form.whatsapp.trim() || undefined,
      city: form.city.trim() || undefined,
      state: form.state.trim() || undefined,
      pincode: form.pincode.trim() || undefined,
      source: form.source,
      tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
      assignedTo: form.assignedTo.trim() || settings.defaultAssignee,
      rating: form.rating,
      status: form.status,
      notes: form.notes.trim() || undefined,
      linkedCustomerId: form.linkedCustomerId || null,
      customFields: {}
    })

    navigate(`/admin/crm/contacts/${contact.id}`)
  }

  return (
    <div className="dash-view space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Button asChild variant="ghost" className="gap-2 px-0 hover:bg-transparent hover:text-primary">
            <Link to="/admin/crm/contacts">
              <ArrowLeft className="h-4 w-4" />
              Back to contacts
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New contact</h1>
            <p className="text-sm text-muted-foreground">Capture the minimum useful CRM record. We can always enrich it later.</p>
          </div>
        </div>
        <Badge variant="secondary">Defaults: {settings.defaultAssignee}</Badge>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className={panelClassName()}>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Primary details</CardTitle>
            <CardDescription>Keep it simple. Use the fields that sales actually looks at.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 grid gap-3 sm:grid-cols-3">
              <Select value={form.type} onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as FormState['type'] }))}>
                <option value="CUSTOMER">Customer</option>
                <option value="LEAD">Lead</option>
                <option value="VENDOR">Vendor</option>
                <option value="PARTNER">Partner</option>
              </Select>
              <Select value={form.entityType} onChange={(event) => setForm((prev) => ({ ...prev, entityType: event.target.value as FormState['entityType'] }))}>
                <option value="INDIVIDUAL">Individual</option>
                <option value="BUSINESS">Business</option>
              </Select>
              <Select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as FormState['status'] }))}>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="BLOCKED">Blocked</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">First name</label>
              <Input value={form.firstName} onChange={(event) => setForm((prev) => ({ ...prev, firstName: event.target.value }))} placeholder="Aarav" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Last name</label>
              <Input value={form.lastName} onChange={(event) => setForm((prev) => ({ ...prev, lastName: event.target.value }))} placeholder="Mehta" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Company</label>
              <Input value={form.company} onChange={(event) => setForm((prev) => ({ ...prev, company: event.target.value }))} placeholder="Mehta Menswear" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Designation</label>
              <Input value={form.designation} onChange={(event) => setForm((prev) => ({ ...prev, designation: event.target.value }))} placeholder="Owner" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <Input value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="customer@example.com" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Phone</label>
              <Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} placeholder="+91..." />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">WhatsApp</label>
              <Input value={form.whatsapp} onChange={(event) => setForm((prev) => ({ ...prev, whatsapp: event.target.value }))} placeholder="+91..." />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Display name</label>
              <Input value={form.displayName} onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))} placeholder="Auto-computed if left blank" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">City</label>
              <Input value={form.city} onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))} placeholder="Mumbai" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">State</label>
              <Input value={form.state} onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))} placeholder="Maharashtra" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Pincode</label>
              <Input value={form.pincode} onChange={(event) => setForm((prev) => ({ ...prev, pincode: event.target.value }))} placeholder="400001" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Source</label>
              <Select value={form.source} onChange={(event) => setForm((prev) => ({ ...prev, source: event.target.value as FormState['source'] }))}>
                <option value="WALK_IN">Walk-in</option>
                <option value="REFERRAL">Referral</option>
                <option value="WEBSITE">Website</option>
                <option value="SOCIAL_MEDIA">Social media</option>
                <option value="COLD_CALL">Cold call</option>
                <option value="EXHIBITION">Exhibition</option>
                <option value="OTHER">Other</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Assigned to</label>
              <Input value={form.assignedTo} onChange={(event) => setForm((prev) => ({ ...prev, assignedTo: event.target.value }))} placeholder={settings.defaultAssignee} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Rating</label>
              <Select value={form.rating} onChange={(event) => setForm((prev) => ({ ...prev, rating: event.target.value as FormState['rating'] }))}>
                <option value="HOT">Hot</option>
                <option value="WARM">Warm</option>
                <option value="COLD">Cold</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Tags</label>
              <Input value={form.tags} onChange={(event) => setForm((prev) => ({ ...prev, tags: event.target.value }))} placeholder="repeat-buyer, wholesale, festival" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={5}
                className="flex min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Useful context for follow-ups"
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className={panelClassName()}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Link to existing customer</CardTitle>
              <CardDescription>Optional, but useful for showing billing and order history on the profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={form.linkedCustomerId} onChange={(event) => setForm((prev) => ({ ...prev, linkedCustomerId: event.target.value }))}>
                <option value="">No link</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">Linking a contact is the difference between a list and an actual relationship view.</p>
            </CardContent>
          </Card>

          <Card className={panelClassName()}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Preview</CardTitle>
              <CardDescription>This is how the contact will look in the directory.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">
                  {initials}
                </div>
                <div>
                  <p className="font-medium">{computedDisplayName || 'New contact'}</p>
                  <p className="text-xs text-muted-foreground">{form.company || form.designation || 'No company entered yet'}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{form.type}</Badge>
                <Badge variant="secondary">{form.entityType}</Badge>
                <Badge variant={form.rating === 'HOT' ? 'destructive' : form.rating === 'WARM' ? 'warning' : 'secondary'}>{form.rating}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Source</p>
                  <p className="mt-1">{form.source}</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className="mt-1">{form.status}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={panelClassName()}>
            <CardContent className="flex flex-wrap items-center justify-end gap-3 p-4">
              <Button asChild type="button" variant="outline">
                <Link to="/admin/crm/contacts">Cancel</Link>
              </Button>
              <Button type="submit">
                <Save className="mr-2 h-4 w-4" />
                Create Contact
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  )
}
