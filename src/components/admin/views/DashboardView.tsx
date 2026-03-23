import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  BarChart3,
  CalendarRange,
  Coins,
  LineChart,
  Percent,
  ReceiptText,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Users,
  Wallet
} from 'lucide-react'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Skeleton } from '../../ui/skeleton'
import { fmt } from '../../../utils'
import { useAdminStore } from '@/lib/store'
import { useBillingStore } from '@/lib/billingStore'
import { getBusinessModeConfig } from '@/lib/businessMode'
import { getCurrentFinancialYear } from '@/lib/gst'
import { formatCompactCurrency } from './analytics/format'
import {
  type ChartSeries,
  type CohortRow
} from './analytics/charts'

const MultiLineChart = lazy(() => import('./analytics/MultiLineChart'))
const HorizontalBarChart = lazy(() => import('./analytics/HorizontalBarChart'))
const CohortHeatmap = lazy(() => import('./analytics/CohortHeatmap'))

type StatTrend = {
  value: number
  text: string
}

const MONTH_LABEL = new Intl.DateTimeFormat('en-IN', { month: 'short' })
const COHORT_LABEL = new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' })

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function computeTrend(current: number, baseline: number): StatTrend {
  if (!baseline) {
    return { value: 0, text: '0.0% from last period' }
  }

  const raw = ((current - baseline) / baseline) * 100
  const value = Number(raw.toFixed(1))
  const sign = value >= 0 ? '+' : ''
  return { value, text: `${sign}${value}% from last period` }
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

function ChartLoading() {
  return (
    <div className="analytics-chart-frame flex min-h-[16rem] items-center justify-center">
      <div className="space-y-3 text-center">
        <Skeleton className="mx-auto h-4 w-32" />
        <Skeleton className="mx-auto h-44 w-full max-w-4xl" />
      </div>
    </div>
  )
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, offset: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function buildMonthSequence(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, index) => addMonths(start, index))
}

function formatMonthLabel(date: Date): string {
  return MONTH_LABEL.format(date)
}

function formatCohortLabel(date: Date): string {
  return COHORT_LABEL.format(date)
}

function splitCohortBand(totalOrders: number): '1' | '2-3' | '4-5' | '6+' {
  if (totalOrders <= 1) return '1'
  if (totalOrders <= 3) return '2-3'
  if (totalOrders <= 5) return '4-5'
  return '6+'
}
export default function DashboardView() {
  const { orders, products, customers } = useAdminStore()
  const { invoices, payments, businessProfile } = useBillingStore()
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate] = useState(() => new Date())
  const businessMode = getBusinessModeConfig(businessProfile)
  const isGstMode = businessMode.mode === 'GST'

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 550)
    return () => window.clearTimeout(timer)
  }, [])

  const analytics = useMemo(() => {
    const overviewMonths = buildMonthSequence(addMonths(startOfMonth(currentDate), -11), 12)
    const forecastMonths = buildMonthSequence(addMonths(startOfMonth(currentDate), 1), 4)

    const orderRevenueByMonth = new Map<string, number>()
    const invoiceRevenueByMonth = new Map<string, number>()
    const taxByMonth = new Map<string, number>()
    const paymentByMonth = new Map<string, number>()

    for (const order of orders) {
      const key = monthKey(startOfMonth(new Date(getOrderDate(order))))
      orderRevenueByMonth.set(key, round2((orderRevenueByMonth.get(key) ?? 0) + order.total))
    }

    for (const invoice of invoices) {
      const key = monthKey(startOfMonth(new Date(invoice.issueDate)))
      const isEligible = invoice.status !== 'DRAFT' && invoice.status !== 'CANCELLED' && invoice.type !== 'PROFORMA'
      if (!isEligible) continue

      const sign = invoice.type === 'CREDIT_NOTE' ? -1 : 1
      invoiceRevenueByMonth.set(key, round2((invoiceRevenueByMonth.get(key) ?? 0) + sign * invoice.taxBreakdown.grandTotal))

      const taxableKey = monthKey(startOfMonth(new Date(invoice.issueDate)))
      taxByMonth.set(taxableKey, round2((taxByMonth.get(taxableKey) ?? 0) + sign * invoice.taxBreakdown.totalTax))
    }

    for (const payment of payments) {
      const key = monthKey(startOfMonth(new Date(payment.date)))
      paymentByMonth.set(key, round2((paymentByMonth.get(key) ?? 0) + payment.amount))
    }

    const revenueTrendPoints = overviewMonths.map((month) => {
      const key = monthKey(month)
      const orderRevenue = round2(orderRevenueByMonth.get(key) ?? 0)
      const invoiceRevenue = round2(invoiceRevenueByMonth.get(key) ?? 0)
      return {
        month,
        label: formatMonthLabel(month),
        orderRevenue,
        invoiceRevenue,
        totalRevenue: round2(orderRevenue + invoiceRevenue)
      }
    })

    const historicalRevenue = revenueTrendPoints.map((point) => point.totalRevenue)
    const firstHalfRevenue = historicalRevenue.slice(0, 6).reduce((sum, value) => sum + value, 0)
    const secondHalfRevenue = historicalRevenue.slice(6).reduce((sum, value) => sum + value, 0)

    const activeInvoices = invoices.filter(
      (invoice) => invoice.status !== 'DRAFT' && invoice.status !== 'CANCELLED' && invoice.type !== 'PROFORMA'
    )

    const activeInvoiceRevenue = activeInvoices.reduce((sum, invoice) => sum + invoice.taxBreakdown.grandTotal, 0)
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0) + activeInvoiceRevenue
    const totalOrders = orders.length
    const activeCustomers = customers.filter((customer) => customer.status === 'active').length
    const productsInStock = products.filter((product) => product.stock > 0).length
    const repeatCustomers = customers.filter((customer) => customer.totalOrders > 1).length
    const productRevenueMap = new Map<
      string,
      {
        product: (typeof products)[number]
        units: number
        revenue: number
      }
    >()

    for (const order of orders) {
      const matches = order.items
        .map((item) => ({
          item,
          product:
            products.find((entry) => entry.id === item.productId) ??
            products.find((entry) => entry.name === item.name)
        }))
        .filter(
          (item): item is { item: (typeof order.items)[number]; product: (typeof products)[number] } =>
            Boolean(item.product)
        )

      const totalWeight = matches.reduce((sum, entry) => sum + entry.item.qty * entry.item.unitPrice, 0) || order.total || 1

      matches.forEach(({ item, product }) => {
        if (!product) return

        const weight = item.qty * item.unitPrice
        const attributedRevenue = (order.total * weight) / totalWeight
        const current = productRevenueMap.get(product.id) ?? { product, units: 0, revenue: 0 }
        current.units += item.qty
        current.revenue = round2(current.revenue + attributedRevenue)
        productRevenueMap.set(product.id, current)
      })
    }

    const topProducts = [...productRevenueMap.values()]
      .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
      .slice(0, 5)

    const cohortMap = new Map<string, CohortRow>()
    for (const customer of customers) {
      const cohortDate = startOfMonth(new Date(customer.joinedAt))
      const key = monthKey(cohortDate)
      const existing = cohortMap.get(key) ?? {
        label: formatCohortLabel(cohortDate),
        date: cohortDate,
        size: 0,
        repeatRate: 0,
        averageOrders: 0,
        averageSpend: 0,
        bands: { '1': 0, '2-3': 0, '4-5': 0, '6+': 0 }
      }

      existing.size += 1
      existing.averageOrders += customer.totalOrders
      existing.averageSpend += customer.totalSpent
      if (customer.totalOrders > 1) existing.repeatRate += 1
      existing.bands[splitCohortBand(customer.totalOrders)] += 1
      cohortMap.set(key, existing)
    }

    const cohortRows = [...cohortMap.values()]
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((row) => ({
        ...row,
        repeatRate: row.size ? round2(row.repeatRate / row.size) : 0,
        averageOrders: row.size ? round2(row.averageOrders / row.size) : 0,
        averageSpend: row.size ? round2(row.averageSpend / row.size) : 0
      }))

    const gstActualMonths = buildMonthSequence(addMonths(startOfMonth(currentDate), -7), 8)
    const gstForecastMonthsList = buildMonthSequence(addMonths(startOfMonth(currentDate), 1), 4)
    const gstLabels = [...gstActualMonths, ...gstForecastMonthsList].map(formatMonthLabel)
    const gstActualValues = gstActualMonths.map((month) => round2(taxByMonth.get(monthKey(month)) ?? 0))

    const nonZeroTaxHistory = gstActualValues.filter((value) => value > 0)
    const taxBase = nonZeroTaxHistory.slice(-3).reduce((sum, value) => sum + value, 0) / Math.max(nonZeroTaxHistory.slice(-3).length, 1)
    const taxTrendFactor =
      nonZeroTaxHistory.length >= 2
        ? clamp(
            (nonZeroTaxHistory[nonZeroTaxHistory.length - 1] - nonZeroTaxHistory[0]) / Math.max(nonZeroTaxHistory[0], 1),
            -0.12,
            0.18
          )
        : 0
    const gstForecastValues = gstForecastMonthsList.map((_, index) =>
      round2(Math.max(0, taxBase * (1 + taxTrendFactor * 0.5 + 0.05 * (index + 1))))
    )
    const gstSeriesValues = [...gstActualValues, ...gstForecastValues]
    const gstForecastTotal = round2(gstForecastValues.reduce((sum, value) => sum + value, 0))
    const gstTrend = computeTrend(
      nonZeroTaxHistory.slice(-3).reduce((sum, value) => sum + value, 0),
      nonZeroTaxHistory.slice(-6, -3).reduce((sum, value) => sum + value, 0) || 1
    )
    const gstPeakIndex = gstSeriesValues.indexOf(Math.max(...gstSeriesValues, 0))

    const salesActualMonths = buildMonthSequence(addMonths(startOfMonth(currentDate), -7), 8)
    const salesForecastMonthsList = buildMonthSequence(addMonths(startOfMonth(currentDate), 1), 4)
    const salesLabels = [...salesActualMonths, ...salesForecastMonthsList].map(formatMonthLabel)
    const salesActualValues = salesActualMonths.map((month) => round2(orderRevenueByMonth.get(monthKey(month)) ?? 0))
    const salesHistory = salesActualValues.filter((value) => value > 0)
    const salesBase = salesHistory.slice(-3).reduce((sum, value) => sum + value, 0) / Math.max(salesHistory.slice(-3).length, 1)
    const salesTrendFactor =
      salesHistory.length >= 2
        ? clamp(
            (salesHistory[salesHistory.length - 1] - salesHistory[0]) / Math.max(salesHistory[0], 1),
            -0.15,
            0.22
          )
        : 0.06
    const salesForecastValues = salesForecastMonthsList.map((_, index) =>
      round2(Math.max(0, salesBase * (1 + salesTrendFactor * 0.45 + 0.04 * (index + 1))))
    )
    const salesForecastTotal = round2(salesForecastValues.reduce((sum, value) => sum + value, 0))
    const salesSeriesValues = [...salesActualValues, ...salesForecastValues]
    const salesTrend = computeTrend(
      salesHistory.slice(-3).reduce((sum, value) => sum + value, 0),
      salesHistory.slice(-6, -3).reduce((sum, value) => sum + value, 0) || 1
    )
    const salesPeakIndex = salesSeriesValues.indexOf(Math.max(...salesSeriesValues, 0))

    const activePaymentByMonth = gstActualMonths.map((month) => round2(paymentByMonth.get(monthKey(month)) ?? 0))
    const collectionCoverageRaw =
      activeInvoices.length && activeInvoices.reduce((sum, invoice) => sum + invoice.taxBreakdown.grandTotal, 0)
        ? activeInvoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0) /
          activeInvoices.reduce((sum, invoice) => sum + invoice.taxBreakdown.grandTotal, 0)
        : 0
    const collectionCoverageRate = clamp(collectionCoverageRaw || 0.68, 0.5, 0.95)
    const overdueBalance = activeInvoices
      .filter((invoice) => startOfMonth(new Date(invoice.dueDate)).getTime() < startOfMonth(currentDate).getTime() && invoice.balanceDue > 0)
      .reduce((sum, invoice) => sum + invoice.balanceDue, 0)

    const futureCollections = gstForecastMonthsList.map((_, index) => {
      const collectionRamp = [0.42, 0.3, 0.18, 0.1][index] ?? 0.08
      return round2(
        Math.max(
          0,
          (activePaymentByMonth.slice(-3).reduce((sum, value) => sum + value, 0) / Math.max(Math.min(activePaymentByMonth.filter(Boolean).length, 3), 1)) *
            (1 + index * 0.02) +
            overdueBalance * collectionCoverageRate * collectionRamp
        )
      )
    })

    const cashCollections = [...activePaymentByMonth, ...futureCollections]
    const cashTaxes = [...gstActualValues, ...gstForecastValues]
    const cashNet = cashCollections.map((value, index) => round2(value - (cashTaxes[index] ?? 0)))
    const cashForecastNet = round2(cashNet.slice(-4).reduce((sum, value) => sum + value, 0))
    const cashTrend = computeTrend(cashCollections.slice(-4).reduce((sum, value) => sum + value, 0), cashCollections.slice(-8, -4).reduce((sum, value) => sum + value, 0) || 1)

    const recentOrderTrend = computeTrend(secondHalfRevenue, firstHalfRevenue || 1)
    const collectionTrend = computeTrend(
      activeInvoices.reduce((sum, invoice) => sum + invoice.amountPaid, 0),
      activeInvoices.reduce((sum, invoice) => sum + (invoice.taxBreakdown.grandTotal - invoice.amountPaid), 0) || 1
    )
    const repeatRate = customers.length ? repeatCustomers / customers.length : 0

    return {
      revenueTrendPoints,
      topProducts,
      cohortRows,
      gst: {
        labels: gstLabels,
        values: gstSeriesValues,
        forecastStartIndex: gstActualMonths.length,
        forecastTotal: gstForecastTotal,
        trend: gstTrend,
        peakLabel: gstLabels[gstPeakIndex] ?? gstLabels[gstLabels.length - 1] ?? 'N/A'
      },
      salesOutlook: {
        labels: salesLabels,
        values: salesSeriesValues,
        forecastStartIndex: salesActualMonths.length,
        forecastTotal: salesForecastTotal,
        trend: salesTrend,
        peakLabel: salesLabels[salesPeakIndex] ?? salesLabels[salesLabels.length - 1] ?? 'N/A'
      },
      cashFlow: {
        labels: gstLabels,
        series: [
          { label: 'Collections', color: '#0f766e', values: cashCollections },
          { label: 'GST outflow', color: '#dc2626', values: cashTaxes },
          { label: 'Net cash', color: '#2563eb', values: cashNet }
        ] as ChartSeries[],
        forecastStartIndex: gstActualMonths.length,
        forecastNet: cashForecastNet,
        trend: cashTrend,
        coverage: collectionCoverageRate,
        outstanding: activeInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.balanceDue), 0)
      },
      summary: {
        totalRevenue,
        totalOrders,
        activeCustomers,
        repeatCustomers,
        productsInStock,
        repeatRate,
        collectionCoverage: collectionCoverageRate,
        gstForecastTotal,
        cashForecastNet,
        recentOrderTrend,
        collectionTrend
      }
    }
  }, [orders, products, customers, invoices, payments, currentDate])

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(getOrderDate(b)).getTime() - new Date(getOrderDate(a)).getTime())
      .slice(0, 5)
  }, [orders])

  const topProduct = analytics.topProducts[0]
  const supportingTopProducts = analytics.topProducts.slice(1, 3)
  const latestOrder = recentOrders[0]
  const largestOrder = orders.length
    ? [...orders].reduce((best, order) => (order.total > best.total ? order : best), orders[0])
    : null
  const largestCohort = analytics.cohortRows.reduce(
    (best, row) => (row.size > best.size ? row : best),
    analytics.cohortRows[0] ?? { label: 'N/A', size: 0, repeatRate: 0, averageOrders: 0, averageSpend: 0, date: new Date(), bands: { '1': 0, '2-3': 0, '4-5': 0, '6+': 0 } }
  )

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

  const heroMetrics = isGstMode
    ? [
        {
          label: 'Revenue',
          value: fmt.format(analytics.summary.totalRevenue),
          helper: analytics.summary.recentOrderTrend.text,
          icon: LineChart
        },
        {
          label: 'Tax outflow 90d',
          value: fmt.format(analytics.gst.forecastTotal),
          helper: analytics.gst.trend.text,
          icon: ReceiptText
        },
        {
          label: 'Net cash',
          value: fmt.format(analytics.cashFlow.forecastNet),
          helper: analytics.cashFlow.trend.text,
          icon: Wallet
        },
        {
          label: 'Repeat rate',
          value: `${Math.round(analytics.summary.repeatRate * 100)}%`,
          helper: `${analytics.cohortRows.length} customer cohorts`,
          icon: Percent
        }
      ]
    : [
        {
          label: 'Revenue',
          value: fmt.format(analytics.summary.totalRevenue),
          helper: analytics.summary.recentOrderTrend.text,
          icon: LineChart
        },
        {
          label: 'Net cash',
          value: fmt.format(analytics.cashFlow.forecastNet),
          helper: analytics.cashFlow.trend.text,
          icon: Wallet
        },
        {
          label: 'Repeat rate',
          value: `${Math.round(analytics.summary.repeatRate * 100)}%`,
          helper: `${analytics.cohortRows.length} customer cohorts`,
          icon: Percent
        }
      ]

  const featuredHeroMetric = heroMetrics[0]
  const supportingHeroMetrics = heroMetrics.slice(1)

  const analysisCards = [
    {
      label: 'Repeat Customer Rate',
      value: `${Math.round(analytics.summary.repeatRate * 100)}%`,
      description: 'Share of customers placing more than one order.',
      icon: Users,
      accent: 'text-blue-600',
      note: `${analytics.cohortRows.filter((row) => row.repeatRate >= analytics.summary.repeatRate).length} cohorts above average`
    },
    isGstMode
      ? {
          label: 'Tax outflow 90d',
          value: fmt.format(analytics.gst.forecastTotal),
          description: 'Projected tax outflow from the next three forecast months.',
          icon: ReceiptText,
          accent: 'text-rose-600',
          note: `${analytics.gst.peakLabel} is the strongest tax month in view`
        }
      : {
          label: 'Sales outlook 90d',
          value: fmt.format(analytics.salesOutlook.forecastTotal),
          description: 'Projected order revenue across the next three months.',
          icon: LineChart,
          accent: 'text-blue-600',
          note: `${analytics.salesOutlook.peakLabel} is the strongest sales month in view`
        },
    {
      label: '90-Day Net Cash',
      value: fmt.format(analytics.cashFlow.forecastNet),
      description: 'Projected collections after GST outflow for the next quarter.',
      icon: Wallet,
      accent: 'text-emerald-600',
      note: `${Math.round(analytics.cashFlow.coverage * 100)}% collection coverage on active invoices`
    },
    {
      label: 'Outstanding Receivables',
      value: fmt.format(analytics.cashFlow.outstanding),
      description: 'Open invoice balance still waiting to be collected.',
      icon: Coins,
      accent: 'text-amber-600',
      note: 'Used to soften the collection forecast'
    }
  ]

  const statCards = [
    {
      label: 'Gross Revenue',
      value: fmt.format(analytics.summary.totalRevenue),
      trend: analytics.summary.recentOrderTrend,
      icon: LineChart
    },
    {
      label: 'Total Orders',
      value: analytics.summary.totalOrders.toLocaleString('en-IN'),
      trend: metrics.totalOrders.trend,
      icon: ShoppingCart
    },
    {
      label: 'Active Customers',
      value: analytics.summary.activeCustomers.toLocaleString('en-IN'),
      trend: metrics.activeCustomers.trend,
      icon: Users
    },
    {
      label: 'Products in Stock',
      value: analytics.summary.productsInStock.toLocaleString('en-IN'),
      trend: metrics.productsInStock.trend,
      icon: BarChart3
    }
  ]

  const businessSnapshot = useMemo(() => {
    const currentFinancialYear = getCurrentFinancialYear(new Date())
    const activeInvoices = invoices.filter((invoice) => invoice.status !== 'DRAFT' && invoice.status !== 'CANCELLED')
    const thisYearInvoices = activeInvoices.filter((invoice) => invoice.financialYear === currentFinancialYear)
    const turnover = thisYearInvoices.reduce((sum, invoice) => sum + invoice.taxBreakdown.grandTotal, 0)
    const outstandingReceivables = activeInvoices.reduce((sum, invoice) => sum + Math.max(0, invoice.balanceDue), 0)
    const taxPayable = thisYearInvoices.reduce((sum, invoice) => sum + invoice.taxBreakdown.totalTax, 0)
    const threshold = businessProfile.businessCategory === 'SERVICES' ? 2000000 : 4000000
    const compositionLimit = 15000000
    const eInvoiceLimit = 50000000
    const nearingThreshold = turnover >= threshold * 0.8
    const nearingComposition = businessMode.mode === 'COMPOSITION' && turnover >= compositionLimit * 0.8
    const eInvoiceNotice = businessMode.mode === 'GST' && turnover >= eInvoiceLimit

    return {
      currentFinancialYear,
      turnover,
      outstandingReceivables,
      taxPayable,
      threshold,
      nearingThreshold,
      nearingComposition,
      eInvoiceNotice
    }
  }, [invoices, businessProfile, businessMode.mode])

  return (
    <div className="dash-view analytics-dashboard space-y-6">
      {isLoading ? (
        <>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-3 h-9 w-96" />
            <Skeleton className="mt-3 h-4 w-4/5" />
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="analytics-panel lg:col-span-2">
              <CardContent className="space-y-3 pt-6">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-44 w-full" />
              </CardContent>
            </Card>
            <Card className="analytics-panel">
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
          <Card className="analytics-panel border-amber-200 bg-amber-50">
            <CardContent className="flex items-center gap-3 p-4 text-sm text-amber-950">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1 overflow-hidden">
                <div className="analytics-demo-notice-track">
                  <span>
                    You are viewing a demo product. This product is currently under development. The analytics below are derived from seeded orders, customers, products, and billing data.
                  </span>
                  <span aria-hidden="true">
                    You are viewing a demo product. This product is currently under development. The analytics below are derived from seeded orders, customers, products, and billing data.
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="analytics-hero relative overflow-hidden border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white shadow-xl">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.12),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.25),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.1),rgba(59,130,246,0.08))]" />
            <CardContent className="analytics-hero-content relative grid gap-8 p-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:p-8">
              <div className="space-y-5">
                <Badge variant="secondary" className="w-fit border-white/10 bg-white/10 text-white">
                  Analytics & Business Intelligence
                </Badge>
                <div className="space-y-4">
                  <h1 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl lg:text-[2.9rem] lg:leading-tight">
                    One view for revenue, demand, taxes, and cash.
                  </h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-200 md:text-[0.95rem]">
                    Track sales velocity, product winners, customer cohorts, GST exposure, and projected cash movement from the same dashboard.
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button asChild className="bg-white text-slate-950 hover:bg-slate-100">
                    <Link to="/admin/orders">
                      Explore Orders
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                    <Link to="/admin/billing">
                      Review Billing
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                    <Link to="/admin/customers">
                      Customer Cohorts
                    </Link>
                  </Button>
                </div>
                <div className="analytics-hero-pills flex flex-wrap gap-2 pt-1">
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-slate-200 backdrop-blur-sm">
                    Revenue, GST, and cash in one frame
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs text-slate-200 backdrop-blur-sm">
                    Forecasts shaded for the next 90 days
                  </span>
                </div>
              </div>

              <div className="analytics-hero-board">
                <div className="analytics-featured-metric">
                  {featuredHeroMetric ? (
                    (() => {
                      const Icon = featuredHeroMetric.icon
                      return (
                        <>
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-[0.72rem] uppercase tracking-[0.24em] text-slate-300">
                                {featuredHeroMetric.label}
                              </p>
                              <p className="mt-3 text-[2.1rem] font-semibold leading-none text-white md:text-[2.55rem]">
                                {featuredHeroMetric.value}
                              </p>
                              <p className="mt-2 max-w-lg text-xs leading-5 text-slate-300">
                                {featuredHeroMetric.helper}
                              </p>
                            </div>
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white shadow-[0_8px_20px_rgba(15,23,42,0.22)]">
                              <Icon className="h-4 w-4" />
                            </div>
                          </div>
                          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-white/80 via-sky-200 to-sky-400" />
                          </div>
                        </>
                      )
                    })()
                  ) : null}
                </div>

                <div className={`analytics-support-grid grid gap-4 ${supportingHeroMetrics.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                  {supportingHeroMetrics.map((item) => {
                  const Icon = item.icon
                  return (
                      <div key={item.label} className="analytics-metric-card analytics-support-metric rounded-3xl border border-white/10 bg-white/9 p-4 backdrop-blur-md">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-slate-300">{item.label}</p>
                          <p className="mt-3 text-[1.45rem] font-semibold leading-none text-white md:text-[1.7rem]">{item.value}</p>
                          <p className="mt-2 text-xs leading-5 text-slate-300">{item.helper}</p>
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white shadow-[0_8px_20px_rgba(15,23,42,0.22)]">
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-white/75 via-sky-200 to-sky-400" />
                      </div>
                    </div>
                  )
                })}
              </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {statCards.map((item) => {
              const Icon = item.icon
              const positive = item.trend.value >= 0
              return (
                <Card key={item.label} className="kpi-card analytics-panel analytics-stat-card">
                  <CardHeader className="analytics-card-header flex flex-row items-start justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent className="analytics-card-content">
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

          <Card className="analytics-panel analytics-section-card">
            <CardHeader className="analytics-card-header">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold">Business Pulse</CardTitle>
                  <p className="text-sm text-muted-foreground">Repeat behavior, funding headroom, and collection health at a glance.</p>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Percent className="h-3 w-3" />
                  Operational summary
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="analytics-card-content">
              <div className="analytics-featured-panel grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
                {analysisCards[0] ? (
                  <div className="analytics-featured-tile rounded-2xl border p-4">
                    {(() => {
                      const Icon = analysisCards[0].icon
                      return (
                        <>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Featured</p>
                          <div className="mt-2 flex items-start justify-between gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">{analysisCards[0].label}</p>
                              <p className="mt-1 text-2xl font-semibold tracking-tight">{analysisCards[0].value}</p>
                              <p className="mt-2 text-xs text-muted-foreground">{analysisCards[0].description}</p>
                            </div>
                            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 ${analysisCards[0].accent}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                          </div>
                          <p className="mt-3 text-xs text-slate-500">{analysisCards[0].note}</p>
                          <div className="mt-4 border-t border-slate-200/70 pt-3">
                            <div className="grid grid-cols-3 gap-2">
                              <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2">
                                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Active</p>
                                <p className="mt-1 text-sm font-medium tracking-tight">{analytics.summary.activeCustomers}</p>
                              </div>
                              <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2">
                                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Repeat</p>
                                <p className="mt-1 text-sm font-medium tracking-tight">{analytics.summary.repeatCustomers}</p>
                              </div>
                              <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 px-3 py-2">
                                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Coverage</p>
                                <p className="mt-1 text-sm font-medium tracking-tight">{Math.round(analytics.summary.collectionCoverage * 100)}%</p>
                              </div>
                            </div>
                            <p className="mt-3 text-xs text-muted-foreground">
                              Cohort health is strongest when repeat behavior and collection discipline move together.
                            </p>
                          </div>
                        </>
                      )
                    })()}
                  </div>
                ) : null}
                <div className="analytics-support-grid grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                  {analysisCards.slice(1).map((card) => {
                    const Icon = card.icon
                    return (
                      <div key={card.label} className="analytics-support-tile rounded-2xl border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs text-muted-foreground">{card.label}</p>
                            <p className="mt-1 text-base font-medium tracking-tight">{card.value}</p>
                            <p className="mt-2 text-xs text-muted-foreground">{card.description}</p>
                          </div>
                          <span className={`flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/70 bg-white/70 ${card.accent}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                        </div>
                        <p className="mt-3 text-xs text-slate-500">{card.note}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="analytics-panel analytics-section-card xl:col-span-2">
              <CardHeader className="analytics-card-header space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold">Revenue Trends</CardTitle>
                    <p className="text-sm text-muted-foreground">Orders, invoice revenue, and blended total across the last 12 months.</p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <CalendarRange className="h-3 w-3" />
                    12 month view
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="analytics-card-content">
                <Suspense fallback={<ChartLoading />}>
                  <MultiLineChart
                    labels={analytics.revenueTrendPoints.map((point) => point.label)}
                    series={[
                      {
                        label: 'Orders',
                        color: '#f59e0b',
                        values: analytics.revenueTrendPoints.map((point) => point.orderRevenue)
                      },
                      {
                        label: 'Invoices',
                        color: '#2563eb',
                        values: analytics.revenueTrendPoints.map((point) => point.invoiceRevenue)
                      },
                      {
                        label: 'Total',
                        color: '#0f172a',
                        values: analytics.revenueTrendPoints.map((point) => point.totalRevenue)
                      }
                    ]}
                    ariaLabel="Revenue trend chart"
                  />
                </Suspense>
                <div className="analytics-featured-panel mt-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="analytics-featured-tile rounded-2xl border p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Featured</p>
                    <div className="mt-2 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Total revenue</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight">{fmt.format(analytics.summary.totalRevenue)}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{analytics.summary.recentOrderTrend.text}</p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <LineChart className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                    <div className="analytics-support-tile rounded-2xl border p-3">
                      <p className="text-xs text-muted-foreground">Average month</p>
                      <p className="mt-1 text-base font-medium tracking-tight">
                        {fmt.format(round2(analytics.summary.totalRevenue / Math.max(analytics.revenueTrendPoints.length, 1)))}
                      </p>
                    </div>
                    <div className="analytics-support-tile rounded-2xl border p-3">
                      <p className="text-xs text-muted-foreground">Best month</p>
                      <p className="mt-1 text-base font-medium tracking-tight">
                        {formatCompactCurrency(Math.max(...analytics.revenueTrendPoints.map((point) => point.totalRevenue), 0))}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="analytics-panel analytics-section-card">
              <CardHeader className="analytics-card-header">
                <CardTitle className="text-base font-semibold">
                  {isGstMode ? 'GST Liability Forecast' : 'Sales Outlook'}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {isGstMode
                    ? 'Actual liability history with the next quarter projected.'
                    : 'Order revenue history with the next quarter projected.'}
                </p>
              </CardHeader>
              <CardContent className="analytics-card-content">
                <Suspense fallback={<ChartLoading />}>
                  <MultiLineChart
                    labels={isGstMode ? analytics.gst.labels : analytics.salesOutlook.labels}
                    series={[
                      isGstMode
                        ? {
                            label: 'Tax liability',
                            color: '#dc2626',
                            values: analytics.gst.values
                          }
                        : {
                            label: 'Sales revenue',
                            color: '#2563eb',
                            values: analytics.salesOutlook.values
                          }
                    ]}
                    forecastStartIndex={isGstMode ? analytics.gst.forecastStartIndex : analytics.salesOutlook.forecastStartIndex}
                    ariaLabel={isGstMode ? 'GST liability forecast chart' : 'Sales outlook chart'}
                    height={260}
                  />
                </Suspense>
                <div className="analytics-featured-panel mt-4 grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                  {isGstMode ? (
                    <>
                      <div className="analytics-featured-tile rounded-2xl border p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Featured</p>
                        <div className="mt-2 flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Next 90 days</p>
                            <p className="mt-1 text-2xl font-semibold tracking-tight">{fmt.format(analytics.gst.forecastTotal)}</p>
                            <p className="mt-2 text-xs text-muted-foreground">Projected GST liability outflow</p>
                          </div>
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                            <ReceiptText className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                        <div className="analytics-support-tile rounded-2xl border p-3">
                          <p className="text-xs text-muted-foreground">Peak month</p>
                          <p className="mt-1 text-base font-medium tracking-tight">{analytics.gst.peakLabel}</p>
                        </div>
                        <div className="analytics-support-tile rounded-2xl border p-3">
                          <p className="text-xs text-muted-foreground">Recent trend</p>
                          <p className={`mt-1 inline-flex items-center gap-1 text-base font-medium tracking-tight ${analytics.gst.trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {analytics.gst.trend.value >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                            {analytics.gst.trend.text}
                          </p>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="analytics-featured-tile rounded-2xl border p-4">
                        <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Featured</p>
                        <div className="mt-2 flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Next 90 days</p>
                            <p className="mt-1 text-2xl font-semibold tracking-tight">{fmt.format(analytics.salesOutlook.forecastTotal)}</p>
                            <p className="mt-2 text-xs text-muted-foreground">Projected sales outlook</p>
                          </div>
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                            <LineChart className="h-4 w-4" />
                          </div>
                        </div>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                        <div className="analytics-support-tile rounded-2xl border p-3">
                          <p className="text-xs text-muted-foreground">Peak month</p>
                          <p className="mt-1 text-base font-medium tracking-tight">{analytics.salesOutlook.peakLabel}</p>
                        </div>
                        <div className="analytics-support-tile rounded-2xl border p-3">
                          <p className="text-xs text-muted-foreground">Recent trend</p>
                          <p className={`mt-1 inline-flex items-center gap-1 text-base font-medium tracking-tight ${analytics.salesOutlook.trend.value >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {analytics.salesOutlook.trend.value >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                            {analytics.salesOutlook.trend.text}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="analytics-panel analytics-section-card">
              <CardHeader className="analytics-card-header">
                <CardTitle className="text-base font-semibold">Top-Selling Products</CardTitle>
                <p className="text-sm text-muted-foreground">Ranked by units sold and estimated attributed revenue.</p>
              </CardHeader>
              <CardContent className="analytics-card-content">
                  <div className="analytics-featured-panel mb-4 grid gap-3 md:grid-cols-[1.15fr_0.85fr]">
                    <div className="analytics-featured-tile rounded-2xl border p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Featured product</p>
                      {topProduct ? (
                      <div className="mt-3 flex items-start gap-3">
                        <img
                          src={topProduct.product.image}
                          alt={topProduct.product.name}
                          className="h-16 w-16 rounded-2xl object-cover shadow-sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-lg font-semibold">{topProduct.product.name}</p>
                          <p className="text-sm text-muted-foreground">{topProduct.product.category}</p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {topProduct.units} units · {formatCompactCurrency(topProduct.revenue)} attributed
                          </p>
                        </div>
                      </div>
                    ) : null}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                      <div className="analytics-support-tile rounded-2xl border p-3">
                        <p className="text-xs text-muted-foreground">Total top-product units</p>
                        <p className="mt-1 text-base font-medium tracking-tight">
                          {analytics.topProducts.reduce((sum, entry) => sum + entry.units, 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="analytics-support-tile rounded-2xl border p-3">
                        <p className="text-xs text-muted-foreground">Additional ranked products</p>
                        <div className="mt-2 space-y-2">
                          {supportingTopProducts.length ? (
                            supportingTopProducts.map((product) => (
                              <div key={product.product.id} className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{product.product.name}</p>
                                  <p className="text-xs text-muted-foreground">{product.units} units</p>
                                </div>
                                <p className="shrink-0 text-xs font-medium text-slate-600">
                                  {formatCompactCurrency(product.revenue)}
                                </p>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">No additional product rankings available.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                <Suspense fallback={<ChartLoading />}>
                  <HorizontalBarChart
                    items={analytics.topProducts.map((entry, index) => ({
                      label: entry.product.name,
                      category: entry.product.category,
                      units: entry.units,
                      revenue: entry.revenue,
                      share: entry.units / Math.max(orders.reduce((sum, order) => sum + order.items.length, 0), 1),
                      color: ['#f59e0b', '#f97316', '#14b8a6', '#3b82f6', '#6366f1'][index % 5]
                    }))}
                  />
                </Suspense>
              </CardContent>
            </Card>

            <Card className="analytics-panel analytics-section-card xl:col-span-2">
              <CardHeader className="analytics-card-header">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-semibold">Cash Flow Projection</CardTitle>
                    <p className="text-sm text-muted-foreground">Collections, GST outflow, and net cash with a forecast window.</p>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <ArrowUpRight className="h-3 w-3" />
                    Forecast region shaded
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="analytics-card-content">
                <Suspense fallback={<ChartLoading />}>
                  <MultiLineChart
                    labels={analytics.cashFlow.labels}
                    series={analytics.cashFlow.series}
                    forecastStartIndex={analytics.cashFlow.forecastStartIndex}
                    ariaLabel="Cash flow projection chart"
                    height={280}
                  />
                </Suspense>
                <div className="analytics-featured-panel mt-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="analytics-featured-tile rounded-2xl border p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Featured</p>
                    <div className="mt-2 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Forecast net cash</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight">{fmt.format(analytics.cashFlow.forecastNet)}</p>
                        <p className="mt-2 text-xs text-muted-foreground">Collections minus GST outflow over the forecast window</p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <Wallet className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                    <div className="analytics-support-tile rounded-2xl border p-3">
                      <p className="text-xs text-muted-foreground">Collections coverage</p>
                      <p className="mt-1 text-base font-medium tracking-tight">{Math.round(analytics.cashFlow.coverage * 100)}%</p>
                    </div>
                    <div className="analytics-support-tile rounded-2xl border p-3">
                      <p className="text-xs text-muted-foreground">Outstanding receivables</p>
                      <p className="mt-1 text-base font-medium tracking-tight">{fmt.format(analytics.cashFlow.outstanding)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="analytics-panel analytics-section-card">
            <CardHeader className="analytics-card-header">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold">Customer Cohort Analysis</CardTitle>
                  <p className="text-sm text-muted-foreground">Cohorts grouped by join month and purchase-depth bands.</p>
                </div>
                <Badge variant="secondary" className="gap-1">
                  <Users className="h-3 w-3" />
                  {analytics.cohortRows.length} cohorts
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="analytics-card-content space-y-4">
              <div className="analytics-featured-panel grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                <div className="analytics-featured-tile rounded-2xl border p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Featured cohort</p>
                  <div className="mt-2 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Largest cohort</p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight">{largestCohort.label}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{largestCohort.size.toLocaleString('en-IN')} customers joined in this month</p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <Users className="h-4 w-4" />
                    </div>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                  <div className="analytics-support-tile rounded-2xl border p-3">
                    <p className="text-xs text-muted-foreground">Highest repeat rate</p>
                    <p className="mt-1 text-base font-medium tracking-tight">
                      {Math.round((largestCohort.repeatRate || 0) * 100)}%
                    </p>
                  </div>
                  <div className="analytics-support-tile rounded-2xl border p-3">
                    <p className="text-xs text-muted-foreground">Average spend / customer</p>
                    <p className="mt-1 text-base font-medium tracking-tight">
                      {fmt.format(round2(customers.reduce((sum, customer) => sum + customer.totalSpent, 0) / Math.max(customers.length, 1)))}
                    </p>
                  </div>
                </div>
              </div>
              <Suspense fallback={<ChartLoading />}>
                <CohortHeatmap rows={analytics.cohortRows} />
              </Suspense>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="analytics-panel analytics-table-card lg:col-span-2">
              <CardHeader className="analytics-card-header flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
                <Link to="/admin/orders" className="text-sm font-medium text-primary hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="analytics-card-content">
                <div className="analytics-featured-panel mb-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
                  <div className="analytics-featured-tile rounded-2xl border p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Featured order</p>
                    {latestOrder ? (
                      <div className="mt-2 flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Latest order</p>
                          <p className="mt-1 text-2xl font-semibold tracking-tight">{latestOrder.id}</p>
                          <p className="mt-2 text-xs text-muted-foreground">{getOrderCustomer(latestOrder)}</p>
                        </div>
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <ShoppingCart className="h-4 w-4" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                    <div className="analytics-support-tile rounded-2xl border p-3">
                      <p className="text-xs text-muted-foreground">Largest order</p>
                      <p className="mt-1 text-base font-medium tracking-tight">{fmt.format(largestOrder?.total ?? 0)}</p>
                    </div>
                    <div className="analytics-support-tile rounded-2xl border p-3">
                      <p className="text-xs text-muted-foreground">Recent orders shown</p>
                      <p className="mt-1 text-base font-medium tracking-tight">{recentOrders.length}</p>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="analytics-report-table w-full text-sm">
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

            <Card className="analytics-panel analytics-snapshot-card">
              <CardHeader className="analytics-card-header">
                <CardTitle className="text-base font-semibold">Business Snapshot</CardTitle>
                <p className="text-sm text-muted-foreground">Turnover and threshold context for the current financial year.</p>
              </CardHeader>
              <CardContent className="analytics-card-content space-y-4">
                <div className="analytics-featured-panel grid gap-3">
                  <div className="analytics-featured-tile rounded-2xl border p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Featured</p>
                    <div className="mt-2 flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">{isGstMode ? 'Turnover' : 'Projected sales'}</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight">
                          {isGstMode ? fmt.format(businessSnapshot.turnover) : fmt.format(analytics.salesOutlook.forecastTotal)}
                        </p>
                        <p className="mt-2 text-xs text-muted-foreground">Current financial year snapshot</p>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                        <ReceiptText className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                  <div className="analytics-snapshot-grid grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-1">
                    <div className="analytics-support-tile rounded-2xl border p-3">
                      <p className="text-xs text-muted-foreground">Financial year</p>
                      <p className="mt-1 text-base font-medium tracking-tight">{businessSnapshot.currentFinancialYear}</p>
                    </div>
                    <div className="analytics-support-tile rounded-2xl border p-3">
                      <p className="text-xs text-muted-foreground">Outstanding receivables</p>
                      <p className="mt-1 text-base font-medium tracking-tight">{fmt.format(businessSnapshot.outstandingReceivables)}</p>
                    </div>
                    <div className="analytics-support-tile rounded-2xl border p-3">
                      <p className="text-xs text-muted-foreground">{isGstMode ? 'Tax payable' : 'Billing mode'}</p>
                      <p className="mt-1 text-base font-medium tracking-tight">{isGstMode ? fmt.format(businessSnapshot.taxPayable) : businessMode.title}</p>
                    </div>
                  </div>
                </div>
                <div className="analytics-callout space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{isGstMode ? 'GST mode' : 'Billing mode'}</span>
                    <span className="font-medium text-slate-900">{businessMode.title}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">{isGstMode ? 'Tax payable' : 'Projected sales'}</span>
                    <span className="font-medium text-slate-900">
                      {isGstMode ? fmt.format(businessSnapshot.taxPayable) : fmt.format(analytics.salesOutlook.forecastTotal)}
                    </span>
                  </div>
                  {businessSnapshot.nearingThreshold ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-amber-900">
                      Your turnover is approaching the GST registration threshold.
                    </p>
                  ) : null}
                  {businessSnapshot.nearingComposition ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-amber-900">
                      Composition turnover is nearing the legal limit.
                    </p>
                  ) : null}
                  {businessSnapshot.eInvoiceNotice ? (
                    <p className="rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-blue-900">
                      E-invoicing is likely mandatory now for this turnover band.
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
