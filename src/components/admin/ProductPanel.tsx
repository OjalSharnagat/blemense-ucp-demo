import { useEffect, useState, type FormEvent } from 'react'
import type { Product } from '../../utils'
import { useBillingStore } from '@/lib/billingStore'
import { getBusinessModeConfig } from '@/lib/businessMode'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Select } from '../ui/select'

type ProductStatus = 'active' | 'draft' | 'archived'

type ProductFormValues = {
  name: string
  sku: string
  category: string
  price: number
  stock: number
  status: ProductStatus
  description: string
  hsn: string
  gstRate: number
}

const defaultValues: ProductFormValues = {
  name: '',
  sku: '',
  category: 'Apparel',
  price: 0,
  stock: 0,
  status: 'active',
  description: '',
  hsn: '',
  gstRate: 0
}

export default function ProductPanel({
  open,
  onOpenChange,
  product,
  categories,
  onSubmit
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
  categories: string[]
  onSubmit: (values: ProductFormValues) => void
}) {
  const { businessProfile } = useBillingStore()
  const businessMode = getBusinessModeConfig(businessProfile)
  const [values, setValues] = useState<ProductFormValues>(defaultValues)

  useEffect(() => {
    if (!open) return

    if (product) {
      setValues({
        name: product.name,
        sku: product.sku || '',
        category: product.category || (categories[0] || 'General'),
        price: product.price,
        stock: product.stock,
        status: (product.status || 'active') as ProductStatus,
        description: product.description || '',
        hsn: product.hsn || '',
        gstRate: product.gstRate || 0
      })
      return
    }

    setValues({
      ...defaultValues,
      category: categories[0] || 'General'
    })
  }, [open, product, categories])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!values.name.trim()) return

    onSubmit({
      ...values,
      name: values.name.trim(),
      sku: values.sku.trim(),
      category: values.category.trim() || 'General',
      price: Math.max(0, Number(values.price) || 0),
      stock: Math.max(0, Number(values.stock) || 0),
      description: values.description.trim(),
      hsn: businessMode.showTaxColumns ? values.hsn.trim().toUpperCase() : '',
      gstRate: businessMode.showTaxColumns ? Math.max(0, Number(values.gstRate) || 0) : 0
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay />
      <DialogContent className="w-[min(94vw,40rem)]">
        <DialogHeader>
          <DialogTitle>{product ? 'Edit Product' : 'Add Product'}</DialogTitle>
          <DialogDescription>
            {product
              ? 'Update core product information and inventory settings.'
              : 'Create a new product entry for your catalog.'}
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="product-name">Name</label>
            <Input
              id="product-name"
              value={values.name}
              onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Nike Air Max 270"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="product-sku">SKU</label>
              <Input
                id="product-sku"
                value={values.sku}
                onChange={(event) => setValues((prev) => ({ ...prev, sku: event.target.value }))}
                placeholder="SKU-001"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="product-category">Category</label>
              <Select
                id="product-category"
                value={values.category}
                onChange={(event) => setValues((prev) => ({ ...prev, category: event.target.value }))}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
                {!categories.length ? <option value="General">General</option> : null}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="product-price">Price (INR)</label>
              <Input
                id="product-price"
                type="number"
                min={0}
                step="1"
                value={values.price}
                onChange={(event) => setValues((prev) => ({ ...prev, price: Number(event.target.value) }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="product-stock">Stock</label>
              <Input
                id="product-stock"
                type="number"
                min={0}
                step="1"
                value={values.stock}
                onChange={(event) => setValues((prev) => ({ ...prev, stock: Number(event.target.value) }))}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="product-status">Status</label>
              <Select
                id="product-status"
                value={values.status}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, status: event.target.value as ProductStatus }))
                }
              >
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="product-description">Description</label>
            <textarea
              id="product-description"
              rows={4}
              value={values.description}
              onChange={(event) => setValues((prev) => ({ ...prev, description: event.target.value }))}
              className="min-h-28 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              placeholder="Add product details"
            />
          </div>

          {businessMode.showTaxColumns ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="product-hsn">HSN / SAC</label>
                <Input
                  id="product-hsn"
                  value={values.hsn}
                  onChange={(event) => setValues((prev) => ({ ...prev, hsn: event.target.value.toUpperCase() }))}
                  placeholder="HSN or SAC"
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium" htmlFor="product-gst-rate">GST Rate (%)</label>
                <Input
                  id="product-gst-rate"
                  type="number"
                  min={0}
                  step="0.1"
                  value={values.gstRate}
                  onChange={(event) => setValues((prev) => ({ ...prev, gstRate: Number(event.target.value) }))}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
              HSN/SAC and GST rate stay hidden for this business profile.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{product ? 'Update Product' : 'Add Product'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
