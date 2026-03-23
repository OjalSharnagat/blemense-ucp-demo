import { useMemo, useState } from 'react'
import { Eye, FilePlus2, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getBusinessModeConfig } from '@/lib/businessMode'
import { useBillingStore } from '@/lib/billingStore'
import { fmt } from '@/utils'
import { Button } from '../../../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card'
import { Input } from '../../../ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../ui/table'
import InvoiceStatusBadge from '../components/InvoiceStatusBadge'

export default function BillingView() {
  const { invoices, businessProfile } = useBillingStore()
  const businessMode = getBusinessModeConfig(businessProfile)
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...invoices]
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime())
      .filter((invoice) => {
        if (!q) return true
        return (
          invoice.invoiceNumber.toLowerCase().includes(q) ||
          invoice.buyer.name.toLowerCase().includes(q) ||
          invoice.type.toLowerCase().includes(q) ||
          invoice.status.toLowerCase().includes(q)
        )
      })
  }, [invoices, query])

  return (
    <div className="dash-view space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
          <p className="text-sm text-muted-foreground">
            Manage {businessMode.mode === 'UNREGISTERED' ? 'bills' : businessMode.mode === 'COMPOSITION' ? 'bills of supply' : 'invoices, credit notes, and debit notes'}.
          </p>
        </div>
        <Button asChild className="gap-2">
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search invoice number, party, type, or status"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Party</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                  <TableCell>{new Date(invoice.issueDate).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell>{invoice.buyer.name}</TableCell>
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
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
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
