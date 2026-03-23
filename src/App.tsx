import { Suspense, lazy, useState } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AdminSidebar from './components/admin/AdminSidebar'
import AdminTopbar from './components/admin/AdminTopbar'
import { AdminStoreProvider } from './lib/store'
import { BillingStoreProvider } from './lib/billingStore'

const DashboardView = lazy(() => import('./components/admin/views/DashboardView'))
const ProductsView = lazy(() => import('./components/admin/views/ProductsView'))
const OrdersView = lazy(() => import('./components/admin/views/OrdersView'))
const CustomersView = lazy(() => import('./components/admin/views/CustomersView'))
const BillingView = lazy(() => import('./components/admin/views/billing/BillingView'))
const InvoiceBuilder = lazy(() => import('./components/admin/views/billing/InvoiceBuilder'))
const InvoicePreview = lazy(() => import('./components/admin/views/billing/InvoicePreview'))
const GSTReturnsView = lazy(() => import('./components/admin/views/billing/GSTReturnsView'))
const PaymentsView = lazy(() => import('./components/admin/views/billing/PaymentsView'))
const BusinessProfileSettings = lazy(() => import('./components/admin/views/billing/BusinessProfileSettings'))
const SettingsView = lazy(() => import('./components/admin/views/SettingsView'))

function RouteLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-border bg-background/80 text-sm text-muted-foreground">
      Loading dashboard section...
    </div>
  )
}

function AdminLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  return (
    <section className="min-h-screen bg-muted/40">
      <AdminSidebar mobileOpen={mobileSidebarOpen} onClose={() => setMobileSidebarOpen(false)} />
      <div className="flex min-h-screen flex-col lg:ml-64">
        <AdminTopbar onOpenSidebar={() => setMobileSidebarOpen(true)} />
        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <AdminStoreProvider>
      <BillingStoreProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />

          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Suspense fallback={<RouteLoading />}><DashboardView /></Suspense>} />
            <Route path="products" element={<Suspense fallback={<RouteLoading />}><ProductsView /></Suspense>} />
            <Route path="orders" element={<Suspense fallback={<RouteLoading />}><OrdersView /></Suspense>} />
            <Route path="customers" element={<Suspense fallback={<RouteLoading />}><CustomersView /></Suspense>} />
            <Route path="billing" element={<Suspense fallback={<RouteLoading />}><BillingView /></Suspense>} />
            <Route path="billing/new" element={<Suspense fallback={<RouteLoading />}><InvoiceBuilder /></Suspense>} />
            <Route path="billing/:id" element={<Suspense fallback={<RouteLoading />}><InvoiceBuilder /></Suspense>} />
            <Route path="billing/:id/preview" element={<Suspense fallback={<RouteLoading />}><InvoicePreview /></Suspense>} />
            <Route path="gst-returns" element={<Suspense fallback={<RouteLoading />}><GSTReturnsView /></Suspense>} />
            <Route path="payments" element={<Suspense fallback={<RouteLoading />}><PaymentsView /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<RouteLoading />}><SettingsView /></Suspense>} />
            <Route path="settings/business-gst" element={<Suspense fallback={<RouteLoading />}><BusinessProfileSettings /></Suspense>} />
          </Route>

          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </BillingStoreProvider>
    </AdminStoreProvider>
  )
}
