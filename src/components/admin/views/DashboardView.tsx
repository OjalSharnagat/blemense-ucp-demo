import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { DollarSign, Package, ShoppingCart, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { Badge } from '../../ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { fmt } from '../../../utils'
import { useAdminStore } from '@/lib/store'
import { Skeleton } from '../../ui/skeleton'

type StatTrend = {
  value: number
  text: string
}

function computeTrend(current: number, baseline: number): StatTrend {
  if (!baseline) {
    return { value: 0, text: '0.0% from last month' }
  }
  const raw = ((current - baseline) / baseline) * 100
  const value = Number(raw.toFixed(1))
  const sign = value >= 0 ? '+' : ''
  return { value, text: `${sign}${value}% from last month` }
}

function getOrderDate(order: { date?: string; createdAt?: string }): string {
  return order.date || order.createdAt || new Date(0).toISOString()
}

function getOrderCustomer(order: { customerName?: string }): string {
  return order.customerName || 'Guest User'
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'success' | 'warning' {
  const normalized = status.toLowerCase()
  if (normalized === 'delivered') return 'success'
  if (normalized === 'shipped') return 'secondary'
  if (normalized === 'processing') return 'default'
  if (normalized === 'pending') return 'warning'
  return 'destructive'
}

export default function DashboardView() {
  const { orders, products, customers } = useAdminStore()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 600)
    return () => window.clearTimeout(timer)
  }, [])

  const metrics = useMemo(() => {
    const sortedOrders = [...orders].sort(
      (a, b) => new Date(getOrderDate(a)).getTime() - new Date(getOrderDate(b)).getTime()
    )

    const midpoint = Math.max(1, Math.floor(sortedOrders.length / 2))
    const previousOrders = sortedOrders.slice(0, midpoint)
    const currentOrders = sortedOrders.slice(midpoint)

    const previousRevenue = previousOrders.reduce((sum, order) => sum + order.total, 0)
    const currentRevenue = currentOrders.reduce((sum, order) => sum + order.total, 0)

    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)
    const totalOrders = orders.length
    const activeCustomers = customers.filter((customer) => customer.status === 'active').length
    const productsInStock = products.filter((product) => product.stock > 0).length

    return {
      totalRevenue: {
        value: fmt.format(totalRevenue),
        trend: computeTrend(currentRevenue, previousRevenue)
      },
      totalOrders: {
        value: totalOrders.toLocaleString('en-IN'),
        trend: computeTrend(currentOrders.length, previousOrders.length)
      },
      activeCustomers: {
        value: activeCustomers.toLocaleString('en-IN'),
        trend: computeTrend(activeCustomers, customers.length - activeCustomers || 1)
      },
      productsInStock: {
        value: productsInStock.toLocaleString('en-IN'),
        trend: computeTrend(productsInStock, Math.max(1, products.length - productsInStock))
      }
    }
  }, [orders, products, customers])

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(getOrderDate(b)).getTime() - new Date(getOrderDate(a)).getTime())
      .slice(0, 5)
  }, [orders])

  const topProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => b.price - a.price)
      .slice(0, 5)
  }, [products])

  const statCards = [
    {
      label: 'Total Revenue',
      value: metrics.totalRevenue.value,
      trend: metrics.totalRevenue.trend,
      icon: DollarSign
    },
    {
      label: 'Total Orders',
      value: metrics.totalOrders.value,
      trend: metrics.totalOrders.trend,
      icon: ShoppingCart
    },
    {
      label: 'Active Customers',
      value: metrics.activeCustomers.value,
      trend: metrics.activeCustomers.trend,
      icon: Users
    },
    {
      label: 'Products in Stock',
      value: metrics.productsInStock.value,
      trend: metrics.productsInStock.trend,
      icon: Package
    }
  ]

  return (
    <div className="dash-view space-y-6">
      {isLoading ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="space-y-3 pt-6">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-28" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="space-y-3 pt-6">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-44 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-3 pt-6">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
      {!isLoading ? (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((item) => {
              const Icon = item.icon
              const positive = item.trend.value >= 0
              return (
                <Card key={item.label} className="kpi-card">
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold tracking-tight">{item.value}</div>
                    <p className={`mt-2 flex items-center gap-1 text-xs ${positive ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {item.trend.text}
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
                <Link to="/admin/orders" className="text-sm font-medium text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="px-2 py-3">Order ID</th>
                        <th className="px-2 py-3">Customer</th>
                        <th className="px-2 py-3">Date</th>
                        <th className="px-2 py-3">Total</th>
                        <th className="px-2 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentOrders.map((order) => (
                        <tr key={order.id} className="border-b last:border-0">
                          <td className="px-2 py-3 font-medium">{order.id}</td>
                          <td className="px-2 py-3">{getOrderCustomer(order)}</td>
                          <td className="px-2 py-3 text-muted-foreground">
                            {new Date(getOrderDate(order)).toLocaleDateString('en-IN')}
                          </td>
                          <td className="px-2 py-3 font-medium">{fmt.format(order.total)}</td>
                          <td className="px-2 py-3">
                            <Badge variant={getStatusVariant(order.status)} className="capitalize">
                              {order.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Top Products</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topProducts.map((product) => (
                    <article key={product.id} className="flex items-center gap-3 rounded-md border p-2">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="h-10 w-10 rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.category}</p>
                      </div>
                      <p className="text-sm font-semibold">{fmt.format(product.price)}</p>
                    </article>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
