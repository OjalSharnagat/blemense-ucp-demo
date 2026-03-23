import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronUp, Eye, Mail, MapPin, PackageSearch, User } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { fmt } from '../../../utils'
import { useAdminStore } from '@/lib/store'
import { useBillingStore } from '@/lib/billingStore'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Input } from '../../ui/input'
import { Select } from '../../ui/select'
import { Skeleton } from '../../ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

type NormalizedItem = {
  name: string
  qty: number
  unitPrice: number
}

type NormalizedOrder = {
  id: string
  customerId?: string
  customerName: string
  customerEmail: string
  date: string
  total: number
  status: OrderStatus
  address: string
  items: NormalizedItem[]
  invoiceId?: string
  invoiceNumber?: string
}

const STATUS_FLOW: Array<Exclude<OrderStatus, 'cancelled'>> = [
  'pending',
  'processing',
  'shipped',
  'delivered'
]

function normalizeStatus(value: string | undefined): OrderStatus {
  const normalized = (value || 'pending').toLowerCase()
  if (normalized === 'processing') return 'processing'
  if (normalized === 'shipped') return 'shipped'
  if (normalized === 'delivered') return 'delivered'
  if (normalized === 'cancelled') return 'cancelled'
  return 'pending'
}

function statusClassName(status: OrderStatus): string {
  if (status === 'pending') return 'border-amber-200 bg-amber-100 text-amber-800'
  if (status === 'processing') return 'border-blue-200 bg-blue-100 text-blue-800'
  if (status === 'shipped') return 'border-violet-200 bg-violet-100 text-violet-800'
  if (status === 'delivered') return 'border-emerald-200 bg-emerald-100 text-emerald-800'
  return 'border-rose-200 bg-rose-100 text-rose-800'
}

function toTitle(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1)
}

export default function OrdersView() {
  const { orders, updateOrderStatus } = useAdminStore()
  const { invoices } = useBillingStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all')
  const [dateSort, setDateSort] = useState<'newest' | 'oldest'>('newest')
  const [sortField, setSortField] = useState<'id' | 'date' | 'total'>('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedOrder, setSelectedOrder] = useState<NormalizedOrder | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 600)
    return () => window.clearTimeout(timer)
  }, [])

  const normalizedOrders = useMemo<NormalizedOrder[]>(() => {
    return orders.map((order) => ({
      id: order.id,
      customerId: order.customerId,
      customerName: order.customerName || 'Guest User',
      customerEmail: order.customerEmail || order.email || 'No email',
      date: order.createdAt || order.date || new Date(0).toISOString(),
      total: order.total,
      status: normalizeStatus(order.status),
      address: 'Address not provided',
      invoiceId: invoices.find((invoice) => invoice.orderId === order.id || (order.customerId && invoice.customerId === order.customerId))?.id ?? order.invoiceId,
      invoiceNumber: invoices.find((invoice) => invoice.orderId === order.id || (order.customerId && invoice.customerId === order.customerId))?.invoiceNumber,
      items: order.items.map((item) => ({
        name: item.name,
        qty: item.qty,
        unitPrice: item.unitPrice
      }))
    }))
  }, [orders, invoices])

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase()

    return [...normalizedOrders]
      .filter((order) => {
        if (!q) return true
        return (
          order.id.toLowerCase().includes(q) ||
          order.customerName.toLowerCase().includes(q) ||
          order.customerEmail.toLowerCase().includes(q)
        )
      })
      .filter((order) => (statusFilter === 'all' ? true : order.status === statusFilter))
      .sort((a, b) => {
        const direction = sortDir === 'asc' ? 1 : -1
        if (sortField === 'id') {
          return a.id.localeCompare(b.id) * direction
        }
        if (sortField === 'total') {
          return (a.total - b.total) * direction
        }
        const aDate = new Date(a.date).getTime()
        const bDate = new Date(b.date).getTime()
        return (aDate - bDate) * direction
      })
  }, [normalizedOrders, search, statusFilter, dateSort, sortDir, sortField])

  useEffect(() => {
    setSortField('date')
    setSortDir(dateSort === 'newest' ? 'desc' : 'asc')
  }, [dateSort])

  function handleStatusChange(nextStatus: OrderStatus) {
    if (!selectedOrder) return

    setSelectedOrder((prev) =>
      prev
        ? {
            ...prev,
            status: nextStatus
          }
        : prev
    )

    updateOrderStatus(selectedOrder.id, nextStatus)
  }

  function timelineState(step: Exclude<OrderStatus, 'cancelled'>, current: OrderStatus) {
    if (current === 'cancelled') return 'upcoming'
    const stepIndex = STATUS_FLOW.indexOf(step)
    const currentIndex = STATUS_FLOW.indexOf(current as Exclude<OrderStatus, 'cancelled'>)
    if (stepIndex < currentIndex) return 'done'
    if (stepIndex === currentIndex) return 'current'
    return 'upcoming'
  }

  function toggleSort(field: 'id' | 'date' | 'total') {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortField(field)
    setSortDir(field === 'date' && dateSort === 'newest' ? 'desc' : 'asc')
  }

  function SortIndicator({ field }: { field: 'id' | 'date' | 'total' }) {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
  }

  const selectedInvoice = useMemo(
    () =>
      selectedOrder?.invoiceId
        ? invoices.find((invoice) => invoice.id === selectedOrder.invoiceId)
        : selectedOrder?.customerId
          ? invoices.find((invoice) => invoice.customerId === selectedOrder.customerId || invoice.orderId === selectedOrder.id)
          : undefined,
    [invoices, selectedOrder],
  )

  const orderParam = searchParams.get('order') || ''

  useEffect(() => {
    if (!orderParam) return
    const matchedOrder = normalizedOrders.find((order) => order.id === orderParam)
    if (matchedOrder) {
      setSelectedOrder(matchedOrder)
    }
  }, [orderParam, normalizedOrders])

  const closeSelectedOrder = () => {
    if (orderParam) {
      const next = new URLSearchParams(searchParams)
      next.delete('order')
      setSearchParams(next, { replace: true })
    }
    setSelectedOrder(null)
  }

  return (
    <div className="dash-view space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">Track fulfillment and review customer order details.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Orders Desk</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {!isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3" data-tour="orders-filters">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search order ID, customer, or email"
            />
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | OrderStatus)}
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </Select>
            <Select
              value={dateSort}
              onChange={(event) => setDateSort(event.target.value as 'newest' | 'oldest')}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </Select>
          </div>
          ) : null}

          {!isLoading ? <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => toggleSort('id')}
                  >
                    Order ID
                    <SortIndicator field="id" />
                  </button>
                </TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => toggleSort('date')}
                  >
                    Date
                    <SortIndicator field="date" />
                  </button>
                </TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Linked Bill</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => toggleSort('total')}
                  >
                    Total
                    <SortIndicator field="total" />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs md:text-sm">{order.id}</TableCell>
                  <TableCell>
                    <div className="font-medium">{order.customerName}</div>
                    <div className="text-xs text-muted-foreground">{order.customerEmail}</div>
                  </TableCell>
                  <TableCell>{new Date(order.date).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell>{order.items.length}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {order.invoiceId ? (
                      <Link className="font-medium text-primary hover:underline" to={`/admin/billing/${order.invoiceId}`}>
                        {order.invoiceNumber || order.invoiceId}
                      </Link>
                    ) : (
                      'Unlinked'
                    )}
                  </TableCell>
                  <TableCell>{fmt.format(order.total)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusClassName(order.status)}>
                      {toTitle(order.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="gap-2"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <Eye className="h-4 w-4" />
                      View details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    <div className="mx-auto flex max-w-xs flex-col items-center gap-2 py-6">
                      <PackageSearch className="h-10 w-10 text-muted-foreground/60" />
                      <p className="font-medium text-foreground">No orders found.</p>
                      <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table> : null}
        </CardContent>
      </Card>

      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          selectedOrder ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={closeSelectedOrder}
        aria-hidden="true"
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-screen w-full max-w-96 flex-col border-l bg-background shadow-2xl transition-transform duration-300 ${
          selectedOrder ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!selectedOrder}
      >
        {selectedOrder ? (
          <>
            <header className="border-b px-6 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Order detail</p>
                  <h2 className="font-mono text-sm font-semibold">{selectedOrder.id}</h2>
                </div>
                <Button variant="ghost" size="sm" onClick={closeSelectedOrder}>
                  Close
                </Button>
              </div>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Customer</h3>
                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  <p className="flex items-center gap-2"><User className="h-4 w-4" /> {selectedOrder.customerName}</p>
                  <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-4 w-4" /> {selectedOrder.customerEmail}</p>
                  <p className="text-xs text-muted-foreground">
                    Customer Ref:{' '}
                    {selectedOrder.customerId ? (
                      <Link className="font-medium text-primary hover:underline" to={`/admin/billing?customer=${selectedOrder.customerId}`}>
                        {selectedOrder.customerId}
                      </Link>
                    ) : (
                      'Not linked'
                    )}
                  </p>
                  <p className="flex items-start gap-2 text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4" /> {selectedOrder.address}</p>
                  <p className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-4 w-4" /> {new Date(selectedOrder.date).toLocaleString('en-IN')}</p>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Linked Billing</h3>
                <div className="space-y-2 rounded-lg border p-3 text-sm">
                  <p className="text-sm">
                    Invoice:{' '}
                    {selectedInvoice ? (
                      <Link className="font-medium text-primary hover:underline" to={`/admin/billing/${selectedInvoice.id}`}>
                        {selectedInvoice.invoiceNumber}
                      </Link>
                    ) : selectedOrder.invoiceId ? (
                      <Link className="font-medium text-primary hover:underline" to={`/admin/billing/${selectedOrder.invoiceId}`}>
                        {selectedOrder.invoiceNumber ?? selectedOrder.invoiceId}
                      </Link>
                    ) : (
                      <span className="font-medium">Not issued yet</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Invoice Ref:{' '}
                    {selectedInvoice?.id || selectedOrder.invoiceId ? (
                      <Link
                        className="font-medium text-primary hover:underline"
                        to={`/admin/billing/${selectedInvoice?.id ?? selectedOrder.invoiceId}`}
                      >
                        {selectedInvoice?.id ?? selectedOrder.invoiceId}
                      </Link>
                    ) : (
                      'Not linked'
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Payment receipts: {selectedInvoice?.paymentHistory.length ?? 0}
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Line Items</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, index) => (
                    <article key={`${item.name}-${index}`} className="rounded-lg border p-3">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty {item.qty} x {fmt.format(item.unitPrice)}</p>
                      <p className="mt-1 text-sm font-semibold">{fmt.format(item.qty * item.unitPrice)}</p>
                    </article>
                  ))}
                </div>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <p className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span>{fmt.format(selectedOrder.total)}</span>
                  </p>
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Status</h3>
                  <Select
                    value={selectedOrder.status}
                    onChange={(event) => handleStatusChange(event.target.value as OrderStatus)}
                    className="h-8 w-36 text-xs"
                  >
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="shipped">Shipped</option>
                    <option value="delivered">Delivered</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                </div>

                <div className="space-y-3 rounded-lg border p-3">
                  {STATUS_FLOW.map((step, index) => {
                    const state = timelineState(step, selectedOrder.status)
                    const isLast = index === STATUS_FLOW.length - 1

                    return (
                      <div key={step} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              state === 'done' || state === 'current' ? 'bg-primary' : 'bg-muted-foreground/30'
                            }`}
                          />
                          {!isLast ? (
                            <span
                              className={`mt-1 h-8 w-px ${
                                state === 'done' ? 'bg-primary' : 'bg-border'
                              }`}
                            />
                          ) : null}
                        </div>
                        <div>
                          <p className={`text-sm ${state === 'current' ? 'font-semibold' : 'text-muted-foreground'}`}>
                            {toTitle(step)}
                          </p>
                        </div>
                      </div>
                    )
                  })}

                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          selectedOrder.status === 'cancelled' ? 'bg-rose-500' : 'bg-muted-foreground/30'
                        }`}
                      />
                    </div>
                    <div>
                      <p
                        className={`text-sm ${
                          selectedOrder.status === 'cancelled'
                            ? 'font-semibold text-rose-600'
                            : 'text-muted-foreground'
                        }`}
                      >
                        Cancelled
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </>
        ) : null}
      </aside>
    </div>
  )
}
