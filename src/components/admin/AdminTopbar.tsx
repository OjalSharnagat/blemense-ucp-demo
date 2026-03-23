import { Bell, ChevronDown, Menu, Search, Sparkles } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Avatar, AvatarFallback } from '../ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { useAdminTour } from './AdminTour'

const titles: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  orders: 'Orders',
  customers: 'Customers',
  settings: 'Settings'
}

export default function AdminTopbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const location = useLocation()
  const { startTour } = useAdminTour()
  const segment = location.pathname.split('/')[2] || 'dashboard'
  const title = titles[segment] ?? 'Admin'
  const adminName = 'Naman Arora'
  const adminInitials = 'NA'

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-6 backdrop-blur">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Open sidebar"
          onClick={onOpenSidebar}
        >
          <Menu className="h-4 w-4" />
        </Button>
        <h1 className="text-sm font-semibold tracking-wide text-foreground">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative hidden md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search..." className="h-9 w-64 pl-9" />
        </div>

        <Button variant="ghost" size="icon" aria-label="Notifications">
          <Bell className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          className="h-9 gap-2 px-3"
          onClick={startTour}
          aria-label="Take product tour"
          data-tour="tour-trigger"
        >
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">Tour</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">{adminInitials}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm sm:inline">{adminName}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">Sign out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
