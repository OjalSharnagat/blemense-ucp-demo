export interface Variant {
  id: string
  size?: string
  color?: string
  stock: number
}

export interface Product {
  id: string
  name: string
  category: string
  price: number
  stock: number
  rating: number
  status?: 'active' | 'draft' | 'archived'
  featured?: boolean
  sku?: string
  image?: string
  images?: string[]
  description?: string
  createdAt?: string
  variants?: Variant[]
  hsn?: string
  gstRate?: number
}

export interface CartItem {
  productId: string
  qty: number
}

export interface Order {
  id: string
  createdAt: string
  status: string
  total: number
  items: Array<{
    productId: string
    name: string
    qty: number
    unitPrice: number
  }>
  customerName?: string
  customerEmail?: string
  email?: string
  date?: string
}

export const fmt = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
})

export function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

export function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export function getPrimaryImage(product: Partial<Product>) {
  const DEFAULT_IMAGE =
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=80'
  if (Array.isArray(product.images) && product.images.length) {
    return product.images[0]
  }
  return product.image || DEFAULT_IMAGE
}

export function totalVariantStock(variants: Variant[]) {
  return variants.reduce((sum, variant) => sum + toNumber(variant.stock, 0), 0)
}

export function getProductStock(product: Partial<Product>) {
  if (Array.isArray(product.variants) && product.variants.length) {
    return totalVariantStock(product.variants)
  }
  return toNumber(product.stock, 0)
}

export function normalizeProduct(product: Partial<Product>) {
  const DEFAULT_IMAGE =
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=80'
  
  const images = Array.isArray(product.images) && product.images.length
    ? product.images.filter(Boolean)
    : product.image
      ? [product.image]
      : [DEFAULT_IMAGE]

  const variants = Array.isArray(product.variants)
    ? product.variants.map((variant) => ({
        id: variant.id || uid('var'),
        size: variant.size || '',
        color: variant.color || '',
        stock: toNumber(variant.stock, 0)
      }))
    : []

  return {
    ...product,
    price: toNumber(product.price, 0),
    rating: toNumber(product.rating, 4.5),
    images,
    image: images[0],
    variants,
    stock: variants.length ? totalVariantStock(variants) : toNumber(product.stock, 0)
  }
}

export async function filesToDataUrls(fileList: FileList | null | undefined) {
  const files = Array.from(fileList || []) as File[]
  const readers = files.map(
    (file) =>
      new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => resolve('')
        reader.readAsDataURL(file)
      })
  )

  const results = await Promise.all(readers)
  return results.filter((value): value is string => Boolean(value))
}

export const STORAGE_KEYS = {
  products: 'pulse_products_v1',
  cart: 'pulse_cart_v1',
  orders: 'pulse_orders_v1'
}

export const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=80'
