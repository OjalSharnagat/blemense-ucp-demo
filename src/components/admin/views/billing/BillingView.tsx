import { useMemo } from 'react'
import { Eye, FilePlus2, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { getBusinessModeConfig } from '@/lib/businessMode'
import { useBillingStore } from '@/lib/billingStore'
import { useAdminStore } from '@/lib/store'
import { fmt } from '@/utils'
import { Button } from '../../../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card'
import { Input } from '../../../ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../ui/table'
import InvoiceStatusBadge from '../components/InvoiceStatusBadge'

export default function BillingView() {
  const { invoices, businessProfile } = useBillingStore()
  const { customers } = useAdminStore()
  const businessMode = getBusinessModeConfig(businessProfile)
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') || ''
  const customerFilter = searchParams.get('customer') || ''
  const orderFilter = searchParams.get('order') || ''

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...invoices]
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())
      .filter((invoice) => {
        if (customerFilter && invoice.customerId !== customerFilter) return false
        if (orderFilter && invoice.orderId !== orderFilter) return false
        if (!q) return true
        const linkedCustomerName = customerById.get(invoice.customerId || '')?.name || ''
        return (
          invoice.invoiceNumber.toLowerCase().includes(q) ||
          invoice.buyer.name.toLowerCase().includes(q) ||
          linkedCustomerName.toLowerCase().includes(q) ||
          (invoice.customerId || '').toLowerCase().includes(q) ||
          (invoice.orderId || '').toLowerCase().includes(q) ||
          invoice.type.toLowerCase().includes(q) ||
          invoice.status.toLowerCase().includes(q)
        )
      })
  }, [invoices, query, customerFilter, orderFilter, customerById])

  const updateQuery = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value.trim()) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="dash-view space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Manage {businessMode.mode === 'UNREGISTERED' ? 'bills' : businessMode.mode === 'COMPOSITION' ? 'bills of supply' : 'invoices, credit notes, and debit notes'}.
          </p>
        </div>
        <Button asChild className="gap-2" data-tour="billing-new-document">
          <Link to="/admin/billing/new">
            <FilePlus2 className="h-4 w-4" />
            New {businessMode.mode === 'UNREGISTERED' ? 'bill' : businessMode.mode === 'COMPOSITION' ? 'bill of supply' : 'invoice'}
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              value={query}
              onChange={(event) => updateQuery(event.target.value)}
              placeholder="Search invoice number, party, type, or status"
            />
          </div>
          {customerFilter || orderFilter ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {customerFilter ? <span className="rounded-full bg-slate-100 px-2 py-1">Customer filter active</span> : null}
              {orderFilter ? <span className="rounded-full bg-slate-100 px-2 py-1">Order filter active</span> : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setSearchParams({}, { replace: true })}
              >
                Clear filters
              </Button>
            </div>
          ) : null}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    <Link className="text-primary hover:underline" to={`/admin/billing/${invoice.id}`}>
                      {invoice.invoiceNumber}
                    </Link>
                  </TableCell>
                  <TableCell>{new Date(invoice.issueDate).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div className="space-y-1">
                      {invoice.customerId ? (
                        <Link className="font-medium text-primary hover:underline" to={`/admin/billing?customer=${invoice.customerId}`}>
                          {customerById.get(invoice.customerId)?.name || 'Linked customer'}
                        </Link>
                      ) : (
                        <p>Not linked</p>
                      )}
                      <p>Party: {invoice.buyer.name}</p>
                      <p>{invoice.customerId || 'Customer ref missing'}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {invoice.orderId ? (
                      <Link className="font-medium text-primary hover:underline" to={`/admin/orders?order=${invoice.orderId}`}>
                        {invoice.orderId}
                      </Link>
                    ) : (
                      'Not linked'
                    )}
                  </TableCell>
                  <TableCell>{invoice.type.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={invoice.status} />
                  </TableCell>
                  <TableCell className="text-right">{fmt.format(invoice.taxBreakdown.grandTotal)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild className="gap-1">
                      <Link to={`/admin/billing/${invoice.id}`}>
                        <Eye className="h-4 w-4" />
                        Open
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No invoices match this search.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
