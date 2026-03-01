import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const selectWrapVariants = cva('relative w-full')
const selectVariants = cva(
  'flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-10 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
)

const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className={selectWrapVariants()}>
      <select ref={ref} className={cn(selectVariants(), className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
)
Select.displayName = 'Select'

export { Select }
