import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Eye, PackageSearch } from 'lucide-react'
import { fmt } from '../../../utils'
import { useAdminStore } from '@/lib/store'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Input } from '../../ui/input'
import { Skeleton } from '../../ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'

const avatarPalette = [
  'bg-rose-100 text-rose-700',
  'bg-amber-100 text-amber-700',
  'bg-emerald-100 text-emerald-700',
  'bg-cyan-100 text-cyan-700',
  'bg-blue-100 text-blue-700',
  'bg-indigo-100 text-indigo-700',
  'bg-violet-100 text-violet-700',
  'bg-pink-100 text-pink-700'
]

function getAvatarColor(name: string): string {
  if (!name) return avatarPalette[0]
  const index = name.charCodeAt(0) % 8
  return avatarPalette[index]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'GU'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export default function CustomersView() {
  const { customers } = useAdminStore()
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState<'name' | 'joinedAt' | 'totalOrders' | 'totalSpent'>('totalSpent')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 600)
    return () => window.clearTimeout(timer)
  }, [])

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase()
    const direction = sortDir === 'asc' ? 1 : -1
    const base = !q
      ? [...customers]
      : customers.filter(
          (customer) =>
            customer.name.toLowerCase().includes(q) || customer.email.toLowerCase().includes(q)
        )

    return base.sort((a, b) => {
      if (sortField === 'name') return a.name.localeCompare(b.name) * direction
      if (sortField === 'totalOrders') return (a.totalOrders - b.totalOrders) * direction
      if (sortField === 'totalSpent') return (a.totalSpent - b.totalSpent) * direction
      return (new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()) * direction
    })
  }, [customers, search, sortField, sortDir])

  function toggleSort(field: 'name' | 'joinedAt' | 'totalOrders' | 'totalSpent') {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortField(field)
    setSortDir('asc')
  }

  function SortIndicator({ field }: { field: 'name' | 'joinedAt' | 'totalOrders' | 'totalSpent' }) {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
  }

  const summary = useMemo(() => {
    const totalCustomers = customers.length
    const activeCount = customers.filter((customer) => customer.status === 'active').length
    const totalSpent = customers.reduce((sum, customer) => sum + customer.totalSpent, 0)
    const totalOrders = customers.reduce((sum, customer) => sum + customer.totalOrders, 0)
    const avgOrderValue = totalOrders ? totalSpent / totalOrders : 0

    return { totalCustomers, activeCount, avgOrderValue }
  }, [customers])

  return (
    <div className="dash-view space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Monitor customer health and purchasing behavior.</p>
        </div>
        <div className="w-full max-w-sm">
          <Input
            type="search"
            placeholder="Search customers"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Customer Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Customers</p>
              <p className="mt-2 text-2xl font-semibold">{summary.totalCustomers.toLocaleString('en-IN')}</p>
            </article>
            <article className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Active Customers</p>
              <p className="mt-2 text-2xl font-semibold">{summary.activeCount.toLocaleString('en-IN')}</p>
            </article>
            <article className="rounded-lg border bg-muted/20 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Avg. Order Value</p>
              <p className="mt-2 text-2xl font-semibold">{fmt.format(summary.avgOrderValue)}</p>
            </article>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Customer Directory</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {!isLoading ? <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Avatar</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => toggleSort('name')}
                  >
                    Name / Email
                    <SortIndicator field="name" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => toggleSort('joinedAt')}
                  >
                    Join Date
                    <SortIndicator field="joinedAt" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => toggleSort('totalOrders')}
                  >
                    Total Orders
                    <SortIndicator field="totalOrders" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => toggleSort('totalSpent')}
                  >
                    Total Spent
                    <SortIndicator field="totalSpent" />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold ${getAvatarColor(customer.name)}`}
                    >
                      {getInitials(customer.name)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{customer.name}</p>
                    <p className="text-xs text-muted-foreground">{customer.email}</p>
                  </TableCell>
                  <TableCell>{new Date(customer.joinedAt).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell>{customer.totalOrders}</TableCell>
                  <TableCell>{fmt.format(customer.totalSpent)}</TableCell>
                  <TableCell>
                    <Badge variant={customer.status === 'active' ? 'success' : 'secondary'} className="capitalize">
                      {customer.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" variant="ghost" size="sm" className="gap-2">
                      <Eye className="h-4 w-4" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {filteredCustomers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    <div className="mx-auto flex max-w-xs flex-col items-center gap-2 py-6">
                      <PackageSearch className="h-10 w-10 text-muted-foreground/60" />
                      <p className="font-medium text-foreground">No customers found.</p>
                      <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table> : null}
        </CardContent>
      </Card>
    </div>
  )
}
