import { useEffect, useMemo, useState } from 'react'
import { Archive, ChevronDown, ChevronUp, Edit, PackageSearch, Plus } from 'lucide-react'
import type { Product } from '../../../utils'
import { fmt, getPrimaryImage, uid } from '../../../utils'
import { useAdminStore } from '@/lib/store'
import { TAX_CODE_MASTER } from '@/data/gst'
import { Badge } from '../../ui/badge'
import { Button } from '../../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card'
import { Input } from '../../ui/input'
import { Select } from '../../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import ProductPanel from '../ProductPanel'
import { Skeleton } from '../../ui/skeleton'

type SortField = 'name' | 'price' | 'stock' | 'createdAt'
type SortDir = 'asc' | 'desc'

type ProductFormValues = {
  name: string
  sku: string
  category: string
  price: number
  stock: number
  status: 'active' | 'draft' | 'archived'
  description: string
  hsn: string
  isService: boolean
  taxCode?: string
  taxCodeType?: 'HSN' | 'SAC'
  taxCodeSource?: 'CATALOG' | 'MANUAL' | 'LEGACY'
  gstRateSource?: 'CATALOG' | 'MANUAL' | 'OVERRIDE' | 'LEGACY'
  gstRateOverride?: number
  gstRate: number
}

function toStatusBadge(status: Product['status']): 'default' | 'secondary' | 'warning' {
  if (status === 'active') return 'default'
  if (status === 'draft') return 'warning'
  return 'secondary'
}

function compareValues(a: Product, b: Product, field: SortField, dir: SortDir) {
  const direction = dir === 'asc' ? 1 : -1
  if (field === 'name') return a.name.localeCompare(b.name) * direction
  if (field === 'price') return (a.price - b.price) * direction
  if (field === 'stock') return (a.stock - b.stock) * direction
  const aTime = new Date(a.createdAt || '').getTime() || 0
  const bTime = new Date(b.createdAt || '').getTime() || 0
  return (aTime - bTime) * direction
}

export default function ProductsView() {
  const { products, addProduct, updateProduct } = useAdminStore()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'draft' | 'archived'>('all')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => setIsLoading(false), 600)
    return () => window.clearTimeout(timer)
  }, [])

  const categories = useMemo(
    () => ['all', ...Array.from(new Set(products.map((product) => product.category)))],
    [products]
  )

  const filteredProducts = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()

    return products
      .filter((product) => {
        if (!searchTerm) return true
        return (
          product.name.toLowerCase().includes(searchTerm) ||
          (product.sku || '').toLowerCase().includes(searchTerm)
        )
      })
      .filter((product) => (categoryFilter === 'all' ? true : product.category === categoryFilter))
      .filter((product) => (statusFilter === 'all' ? true : product.status === statusFilter))
      .sort((a, b) => compareValues(a, b, sortField, sortDir))
  }, [products, search, categoryFilter, statusFilter, sortField, sortDir])

  function openAddModal() {
    setEditingProduct(null)
    setIsModalOpen(true)
  }

  function openEditModal(product: Product) {
    setEditingProduct(product)
    setIsModalOpen(true)
  }

  function handleArchiveProduct(productId: string) {
    const found = products.find((product) => product.id === productId)
    if (!found) return
    updateProduct({ ...found, status: 'archived' })
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortField(field)
    setSortDir('asc')
  }

  function SortIndicator({ field }: { field: SortField }) {
    if (sortField !== field) return null
    return sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
  }

  function handleSave(values: ProductFormValues) {
    const normalizedCode = values.hsn.trim().toUpperCase()
    const matched = TAX_CODE_MASTER.find((entry) => entry.code === normalizedCode)
    if (editingProduct) {
      updateProduct({
        ...editingProduct,
        ...values,
        status: values.status,
        hsn: normalizedCode,
        taxCode: normalizedCode,
        taxCodeType: matched?.codeType ?? (values.isService ? 'SAC' : 'HSN'),
        taxCodeSource: matched ? 'CATALOG' : 'MANUAL',
        gstRateSource: matched ? 'CATALOG' : 'MANUAL',
        isService: values.isService,
        gstRate: Math.max(0, Number(values.gstRate) || 0),
        gstRateOverride: matched && Math.abs((Number(values.gstRate) || 0) - matched.defaultGstRate) > 0.01 ? Number(values.gstRate) : undefined
      })
    } else {
      addProduct({
        id: uid('p'),
        name: values.name,
        category: values.category,
        price: values.price,
        stock: values.stock,
        rating: 4.5,
        status: values.status,
        sku: values.sku,
        description: values.description,
        createdAt: new Date().toISOString(),
        image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=80&h=80&fit=crop',
        images: ['https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=80&h=80&fit=crop'],
        variants: [],
        featured: false,
        hsn: normalizedCode,
        taxCode: normalizedCode,
        taxCodeType: matched?.codeType ?? (values.isService ? 'SAC' : 'HSN'),
        taxCodeSource: matched ? 'CATALOG' : 'MANUAL',
        gstRateSource: matched ? 'CATALOG' : 'MANUAL',
        isService: values.isService,
        gstRate: Math.max(0, Number(values.gstRate) || 0),
        gstRateOverride: matched && Math.abs((Number(values.gstRate) || 0) - matched.defaultGstRate) > 0.01 ? Number(values.gstRate) : undefined
      })
    }

    setIsModalOpen(false)
    setEditingProduct(null)
  }

  return (
    <div className="dash-view space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">Manage catalog, pricing, and stock status.</p>
        </div>
        <Button onClick={openAddModal} className="gap-2" data-tour="products-add-product">
          <Plus className="h-4 w-4" />
          Add Product
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Product Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : null}
          {!isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by product name or SKU"
              />
            </div>
            <Select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All categories' : category}
                </option>
              ))}
            </Select>
            <Select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'all' | 'active' | 'draft' | 'archived')
              }
            >
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={sortField}
                onChange={(event) => setSortField(event.target.value as SortField)}
              >
                <option value="createdAt">Newest</option>
                <option value="name">Name</option>
                <option value="price">Price</option>
                <option value="stock">Stock</option>
              </Select>
              <Select
                value={sortDir}
                onChange={(event) => setSortDir(event.target.value as SortDir)}
              >
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </Select>
            </div>
          </div>
          ) : null}

          {!isLoading ? <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input type="checkbox" aria-label="Select all products" className="h-4 w-4" />
                </TableHead>
                <TableHead className="w-16">Image</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => toggleSort('name')}
                  >
                    Name / SKU
                    <SortIndicator field="name" />
                  </button>
                </TableHead>
                <TableHead>Category</TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => toggleSort('price')}
                  >
                    Price
                    <SortIndicator field="price" />
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => toggleSort('stock')}
                  >
                    Stock
                    <SortIndicator field="stock" />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const stockLow = product.stock < 10
                return (
                  <TableRow key={product.id}>
                    <TableCell>
                      <input type="checkbox" aria-label={`Select ${product.name}`} className="h-4 w-4" />
                    </TableCell>
                    <TableCell>
                      <img
                        src={getPrimaryImage(product)}
                        alt={product.name}
                        className="h-10 w-10 rounded-md object-cover"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">{product.sku || 'SKU-N/A'}</div>
                    </TableCell>
                    <TableCell>{product.category}</TableCell>
                    <TableCell>{fmt.format(product.price)}</TableCell>
                    <TableCell className={stockLow ? 'font-semibold text-amber-600' : ''}>{product.stock}</TableCell>
                    <TableCell>
                      <Badge variant={toStatusBadge(product.status)} className="capitalize">
                        {product.status || 'active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(product)}
                          aria-label={`Edit ${product.name}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleArchiveProduct(product.id)}
                          aria-label={`Archive ${product.name}`}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}

              {filteredProducts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    <div className="mx-auto flex max-w-xs flex-col items-center gap-2 py-6">
                      <PackageSearch className="h-10 w-10 text-muted-foreground/60" />
                      <p className="font-medium text-foreground">No products found.</p>
                      <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table> : null}
        </CardContent>
      </Card>

      <ProductPanel
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        product={editingProduct}
        categories={categories.filter((category) => category !== 'all')}
        onSubmit={handleSave}
      />
    </div>
  )
}
