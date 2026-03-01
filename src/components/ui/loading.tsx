import { Loader2, Package, BarChart3, Users, ShoppingCart } from 'lucide-react'
import { useState, useEffect } from 'react'

export function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16'
  }

  return (
    <Loader2 className={`animate-spin text-primary ${sizeClasses[size]} ${className}`} />
  )
}

export function LoadingCard({ className = '' }) {
  return (
    <div className={`bg-card rounded-lg p-6 animate-pulse ${className}`}>
      <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
      <div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
      <div className="h-3 bg-muted rounded w-1/2"></div>
    </div>
  )
}

export function LoadingTable({ rows = 5, className = '' }) {
  return (
    <div className={`bg-card rounded-lg overflow-hidden ${className}`}>
      <div className="p-4 border-b border-border">
        <div className="h-4 bg-muted rounded w-1/4 animate-pulse"></div>
      </div>
      <div className="p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 mb-4 last:mb-0">
            <div className="h-10 w-10 bg-muted rounded-full animate-pulse"></div>
            <div className="flex-1">
              <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </div>
            <div className="h-8 w-20 bg-muted rounded animate-pulse"></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LoadingDashboard({ className = '' }) {
  const [currentIcon, setCurrentIcon] = useState(0)
  const icons = [BarChart3, Package, Users, ShoppingCart]
  const messages = [
    'Loading analytics...',
    'Fetching products...',
    'Loading customers...',
    'Processing orders...'
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIcon(prev => (prev + 1) % icons.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const IconComponent = icons[currentIcon]

  return (
    <div className={`flex flex-col items-center justify-center min-h-[400px] ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping"></div>
        <div className="relative bg-primary/10 rounded-full p-6">
          <IconComponent className="h-12 w-12 text-primary animate-pulse" />
        </div>
      </div>
      <p className="mt-4 text-lg font-medium text-foreground">{messages[currentIcon]}</p>
      <p className="text-sm text-muted-foreground">Please wait while we load your dashboard</p>
    </div>
  )
}

export function LoadingProductCard({ className = '' }) {
  return (
    <div className={`bg-card rounded-lg overflow-hidden animate-pulse ${className}`}>
      <div className="h-48 bg-muted"></div>
      <div className="p-4">
        <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
        <div className="h-3 bg-muted rounded w-1/2 mb-3"></div>
        <div className="flex justify-between items-center">
          <div className="h-5 bg-muted rounded w-1/4"></div>
          <div className="h-8 bg-muted rounded w-16"></div>
        </div>
      </div>
    </div>
  )
}

export function LoadingChart({ className = '' }) {
  return (
    <div className={`bg-card rounded-lg p-6 animate-pulse ${className}`}>
      <div className="h-4 bg-muted rounded w-1/4 mb-6"></div>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="h-8 bg-muted rounded" style={{ width: `${Math.random() * 60 + 20}%` }}></div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PageLoader({ children, loading = false, error = null }) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="text-red-500 text-lg font-medium mb-2">Error Loading Data</div>
        <div className="text-muted-foreground text-sm">{error}</div>
      </div>
    )
  }

  if (loading) {
    return <LoadingDashboard />
  }

  return children
}