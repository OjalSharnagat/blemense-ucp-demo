import { BarChart3, Building2, FileText, Landmark, LayoutDashboard, Package, Receipt, ScrollText, Settings, ShoppingCart, SlidersHorizontal, Store, Users } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useBillingStore } from '@/lib/billingStore'
import { getBusinessModeConfig } from '@/lib/businessMode'
import { cn } from '../../lib/utils'
import { Avatar, AvatarFallback } from '../ui/avatar'

const linkBase =
  'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors'

export default function AdminSidebar({
  mobileOpen,
  onClose
}: {
  mobileOpen: boolean
  onClose: () => void
}) {
  const { businessProfile } = useBillingStore()
  const businessMode = getBusinessModeConfig(businessProfile)
  const adminName = 'Naman Arora'
  const adminInitials = 'NA'
  const businessName = businessProfile.tradeName || businessProfile.legalName || 'ABC Enterprises'

  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 lg:hidden',
          mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-800 bg-slate-900 text-slate-300 transition-transform duration-300 lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
      <div className="flex h-full flex-col">
        <div className="border-b border-slate-800 px-4 py-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-white">
                <Store className="h-4 w-4" />
              </div>
            <div>
              <p className="text-sm font-semibold text-white">{businessName}</p>
              <p className="text-xs text-slate-400">Admin Console</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-6 px-3 py-4">
          <div>
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Overview</p>
            <div className="mt-2 space-y-1">
              <NavLink
                to="/admin/dashboard"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </NavLink>
            </div>
          </div>

          <div>
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Store</p>
            <div className="mt-2 space-y-1">
              <NavLink
                to="/admin/products"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <Package className="h-4 w-4" />
                Products
              </NavLink>
              <NavLink
                to="/admin/orders"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <ShoppingCart className="h-4 w-4" />
                Orders
              </NavLink>
              <NavLink
                to="/pos"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <ShoppingCart className="h-4 w-4" />
                POS Terminal
              </NavLink>
              <NavLink
                to="/admin/pos/orders"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <ScrollText className="h-4 w-4" />
                POS Orders
              </NavLink>
              <NavLink
                to="/admin/pos/reports"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <BarChart3 className="h-4 w-4" />
                POS Reports
              </NavLink>
              <NavLink
                to="/admin/customers"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <Users className="h-4 w-4" />
                Customers
              </NavLink>
            </div>
          </div>

          <div>
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span className="inline-flex items-center gap-2">
                <Users className="h-3.5 w-3.5" />
                Growth
              </span>
            </p>
            <div className="mt-2 space-y-1">
              <NavLink
                to="/admin/crm"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <Users className="h-4 w-4" />
                CRM
              </NavLink>
              <NavLink
                to="/admin/crm/contacts"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <Users className="h-4 w-4" />
                Contacts
              </NavLink>
              <NavLink
                to="/admin/crm/pipeline"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <Users className="h-4 w-4" />
                Pipeline
              </NavLink>
              <NavLink
                to="/admin/crm/activities"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <Users className="h-4 w-4" />
                Activities
              </NavLink>
              <NavLink
                to="/admin/crm/segments"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <Users className="h-4 w-4" />
                Segments
              </NavLink>
            </div>
          </div>

          <div>
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Finance</p>
            <div className="mt-2 space-y-1">
              <NavLink
                to="/admin/billing"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <Receipt className="h-4 w-4" />
                Billing
              </NavLink>
              {businessMode.showGstReturns ? (
                <NavLink
                  to="/admin/gst-returns"
                  className={({ isActive }) =>
                    cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                  }
                  onClick={onClose}
                >
                  <FileText className="h-4 w-4" />
                  GST Returns
                </NavLink>
              ) : null}
              <NavLink
                to="/admin/payments"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <Landmark className="h-4 w-4" />
                Payments
              </NavLink>
            </div>
          </div>

          <div>
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Settings</p>
            <div className="mt-2 space-y-1">
              <NavLink
                to="/admin/settings"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <Settings className="h-4 w-4" />
                Settings
              </NavLink>
              <NavLink
                to="/admin/settings/pos"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <SlidersHorizontal className="h-4 w-4" />
                POS Configuration
              </NavLink>
              <NavLink
                to="/admin/settings/business-gst"
                className={({ isActive }) =>
                  cn(linkBase, isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800/70 hover:text-slate-100')
                }
                onClick={onClose}
              >
                <Building2 className="h-4 w-4" />
                Business Setup
              </NavLink>
            </div>
          </div>
        </nav>

        <div className="border-t border-slate-800 px-3 py-4">
          <div className="flex items-center justify-between rounded-md bg-slate-800/60 px-3 py-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-blue-600 text-xs text-white">{adminInitials}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-slate-100">{adminName}</p>
                <p className="text-xs text-slate-400">Admin</p>
              </div>
            </div>
            <NavLink to="/admin/settings" className="text-slate-400 hover:text-slate-100">
              <Settings className="h-4 w-4" />
            </NavLink>
          </div>
        </div>
      </div>
      </aside>
    </>
  )
}
