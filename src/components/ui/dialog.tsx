import * as React from 'react'
import { createPortal } from 'react-dom'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

type DialogContextValue = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialogContext() {
  const ctx = React.useContext(DialogContext)
  if (!ctx) {
    throw new Error('Dialog primitives must be used inside <Dialog>.')
  }
  return ctx
}

const overlayVariants = cva('fixed inset-0 z-50 bg-background/70 backdrop-blur-sm')
const contentVariants = cva(
  'fixed left-1/2 top-1/2 z-50 grid w-[min(92vw,32rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-card p-6 shadow-xl'
)
const sectionVariants = cva('grid gap-1.5')

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  return (
    <DialogContext.Provider value={{ open, onOpenChange }}>
      {children}
    </DialogContext.Provider>
  )
}

const DialogOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { open, onOpenChange } = useDialogContext()
    if (!open) return null

    return createPortal(
      <div
        ref={ref}
        className={cn(overlayVariants(), className)}
        onClick={() => onOpenChange(false)}
        {...props}
      />,
      document.body
    )
  }
)
DialogOverlay.displayName = 'DialogOverlay'

const DialogContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { open, onOpenChange } = useDialogContext()

    React.useEffect(() => {
      if (!open) return
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') onOpenChange(false)
      }
      window.addEventListener('keydown', onKeyDown)
      return () => window.removeEventListener('keydown', onKeyDown)
    }, [open, onOpenChange])

    if (!open) return null

    return createPortal(
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={cn(contentVariants(), className)}
        onClick={(event) => event.stopPropagation()}
        {...props}
      />,
      document.body
    )
  }
)
DialogContent.displayName = 'DialogContent'

const DialogHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn(sectionVariants(), 'text-left', className)} {...props} />
  )
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  )
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h2 ref={ref} className={cn('text-lg font-semibold leading-none tracking-tight', className)} {...props} />
  )
)
DialogTitle.displayName = 'DialogTitle'

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
  )
)
DialogDescription.displayName = 'DialogDescription'

export {
  Dialog,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription
}
