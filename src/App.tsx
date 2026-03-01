import { useState } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AdminSidebar from './components/admin/AdminSidebar'
import AdminTopbar from './components/admin/AdminTopbar'
import DashboardView from './components/admin/views/DashboardView'
import ProductsView from './components/admin/views/ProductsView'
import OrdersView from './components/admin/views/OrdersView'
import CustomersView from './components/admin/views/CustomersView'
import BillingView from './components/admin/views/billing/BillingView'
import InvoiceBuilder from './components/admin/views/billing/InvoiceBuilder'
import InvoicePreview from './components/admin/views/billing/InvoicePreview'
import GSTReturnsView from './components/admin/views/billing/GSTReturnsView'
import PaymentsView from './components/admin/views/billing/PaymentsView'
import BusinessProfileSettings from './components/admin/views/billing/BusinessProfileSettings'
import SettingsView from './components/admin/views/SettingsView'
import { AdminStoreProvider } from './lib/store'
import { BillingStoreProvider } from './lib/billingStore'

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
            <Route path="dashboard" element={<DashboardView />} />
            <Route path="products" element={<ProductsView />} />
            <Route path="orders" element={<OrdersView />} />
            <Route path="customers" element={<CustomersView />} />
            <Route path="billing" element={<BillingView />} />
            <Route path="billing/new" element={<InvoiceBuilder />} />
            <Route path="billing/:id" element={<InvoiceBuilder />} />
            <Route path="billing/:id/preview" element={<InvoicePreview />} />
            <Route path="gst-returns" element={<GSTReturnsView />} />
            <Route path="payments" element={<PaymentsView />} />
            <Route path="settings" element={<SettingsView />} />
            <Route path="settings/business-gst" element={<BusinessProfileSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </BillingStoreProvider>
    </AdminStoreProvider>
  )
}
