import { Suspense, lazy, useState } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import AdminSidebar from './components/admin/AdminSidebar'
import AdminTopbar from './components/admin/AdminTopbar'
import { AdminStoreProvider } from './lib/store'
import { BillingStoreProvider } from './lib/billingStore'
import { PosStoreProvider } from './lib/posStore'
import { CRMStoreProvider } from './lib/crmStore'
import { AdminTourProvider } from './components/admin/AdminTour'

const DashboardView = lazy(() => import('./components/admin/views/DashboardView'))
const ProductsView = lazy(() => import('./components/admin/views/ProductsView'))
const OrdersView = lazy(() => import('./components/admin/views/OrdersView'))
const CustomersView = lazy(() => import('./components/admin/views/CustomersView'))
const POSSession = lazy(() => import('./components/admin/views/pos/POSSession'))
const POSTerminal = lazy(() => import('./components/admin/views/pos/POSTerminal'))
const POSOrders = lazy(() => import('./components/admin/views/pos/POSOrders'))
const POSReports = lazy(() => import('./components/admin/views/pos/POSReports'))
const POSSettings = lazy(() => import('./components/admin/views/pos/POSSettings'))
const BillingView = lazy(() => import('./components/admin/views/billing/BillingView'))
const InvoiceBuilder = lazy(() => import('./components/admin/views/billing/InvoiceBuilder'))
const InvoicePreview = lazy(() => import('./components/admin/views/billing/InvoicePreview'))
const GSTReturnsView = lazy(() => import('./components/admin/views/billing/GSTReturnsView'))
const PaymentsView = lazy(() => import('./components/admin/views/billing/PaymentsView'))
const BusinessProfileSettings = lazy(() => import('./components/admin/views/billing/BusinessProfileSettings'))
const SettingsView = lazy(() => import('./components/admin/views/SettingsView'))
const CRMDashboard = lazy(() => import('./components/admin/views/crm/CRMDashboard'))
const ContactsView = lazy(() => import('./components/admin/views/crm/ContactsView'))
const ContactProfile = lazy(() => import('./components/admin/views/crm/ContactProfile'))
const ContactForm = lazy(() => import('./components/admin/views/crm/ContactForm'))
const PipelineView = lazy(() => import('./components/admin/views/crm/PipelineView'))
const ActivitiesView = lazy(() => import('./components/admin/views/crm/ActivitiesView'))
const SegmentsView = lazy(() => import('./components/admin/views/crm/SegmentsView'))
const CampaignsView = lazy(() => import('./components/admin/views/crm/CampaignsView'))
const CRMReports = lazy(() => import('./components/admin/views/crm/CRMReports'))
const CRMSettings = lazy(() => import('./components/admin/views/crm/CRMSettings'))

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
        <PosStoreProvider>
          <CRMStoreProvider>
            <AdminTourProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/pos/session" element={<Suspense fallback={<RouteLoading />}><POSSession /></Suspense>} />
                <Route path="/pos" element={<Suspense fallback={<RouteLoading />}><POSTerminal /></Suspense>} />

                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="dashboard" replace />} />
                  <Route path="dashboard" element={<Suspense fallback={<RouteLoading />}><DashboardView /></Suspense>} />
                  <Route path="products" element={<Suspense fallback={<RouteLoading />}><ProductsView /></Suspense>} />
                  <Route path="orders" element={<Suspense fallback={<RouteLoading />}><OrdersView /></Suspense>} />
                  <Route path="pos/orders" element={<Suspense fallback={<RouteLoading />}><POSOrders /></Suspense>} />
                  <Route path="pos/reports" element={<Suspense fallback={<RouteLoading />}><POSReports /></Suspense>} />
                  <Route path="settings/pos" element={<Suspense fallback={<RouteLoading />}><POSSettings /></Suspense>} />
                  <Route path="customers" element={<Suspense fallback={<RouteLoading />}><CustomersView /></Suspense>} />
                  <Route path="billing" element={<Suspense fallback={<RouteLoading />}><BillingView /></Suspense>} />
                  <Route path="billing/new" element={<Suspense fallback={<RouteLoading />}><InvoiceBuilder /></Suspense>} />
                  <Route path="billing/:id" element={<Suspense fallback={<RouteLoading />}><InvoiceBuilder /></Suspense>} />
                  <Route path="billing/:id/preview" element={<Suspense fallback={<RouteLoading />}><InvoicePreview /></Suspense>} />
                  <Route path="gst-returns" element={<Suspense fallback={<RouteLoading />}><GSTReturnsView /></Suspense>} />
                  <Route path="payments" element={<Suspense fallback={<RouteLoading />}><PaymentsView /></Suspense>} />
                  <Route path="settings" element={<Suspense fallback={<RouteLoading />}><SettingsView /></Suspense>} />
                  <Route path="settings/business-gst" element={<Suspense fallback={<RouteLoading />}><BusinessProfileSettings /></Suspense>} />

                  <Route path="crm" element={<Suspense fallback={<RouteLoading />}><CRMDashboard /></Suspense>} />
                  <Route path="crm/contacts" element={<Suspense fallback={<RouteLoading />}><ContactsView /></Suspense>} />
                  <Route path="crm/contacts/new" element={<Suspense fallback={<RouteLoading />}><ContactForm /></Suspense>} />
                  <Route path="crm/contacts/:id" element={<Suspense fallback={<RouteLoading />}><ContactProfile /></Suspense>} />
                  <Route path="crm/pipeline" element={<Suspense fallback={<RouteLoading />}><PipelineView /></Suspense>} />
                  <Route path="crm/activities" element={<Suspense fallback={<RouteLoading />}><ActivitiesView /></Suspense>} />
                  <Route path="crm/segments" element={<Suspense fallback={<RouteLoading />}><SegmentsView /></Suspense>} />
                  <Route path="crm/campaigns" element={<Suspense fallback={<RouteLoading />}><CampaignsView /></Suspense>} />
                  <Route path="crm/campaigns/:id" element={<Suspense fallback={<RouteLoading />}><CampaignsView /></Suspense>} />
                  <Route path="crm/reports" element={<Suspense fallback={<RouteLoading />}><CRMReports /></Suspense>} />
                  <Route path="crm/settings" element={<Suspense fallback={<RouteLoading />}><CRMSettings /></Suspense>} />
                </Route>

                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
              </Routes>
            </AdminTourProvider>
          </CRMStoreProvider>
        </PosStoreProvider>
      </BillingStoreProvider>
    </AdminStoreProvider>
  )
}
