import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react'
import { customers as mockCustomers, type Customer } from '@/data/customers'
import { orders as mockOrders } from '@/data/orders'
import { products as mockProducts } from '@/data/products'
import type { Order, Product } from '@/utils'

const INITIAL_PRODUCTS: Product[] = mockProducts.map((product) => ({
  id: product.id,
  name: product.name,
  category: product.category,
  price: product.price,
  stock: product.stock,
  rating: 4.5,
  status: product.status,
  sku: product.sku,
  description: product.description,
  createdAt: product.createdAt,
  image: product.image,
  images: [product.image],
  variants: [],
  featured: false
}))

const INITIAL_ORDERS: Order[] = mockOrders.map((order) => {
  const itemCount = Math.max(order.items.length, 1)
  const unitPrice = Math.round(order.total / itemCount)

  return {
    id: order.id,
    createdAt: order.date,
    date: order.date,
    status: order.status,
    total: order.total,
    customerName: order.customer,
    customerEmail: order.email,
    email: order.email,
    items: order.items.map((name) => ({
      productId: `prd-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      qty: 1,
      unitPrice
    }))
  }
})

const INITIAL_CUSTOMERS: Customer[] = [...mockCustomers]

type AdminStoreValue = {
  products: Product[]
  orders: Order[]
  customers: Customer[]
  addProduct: (product: Product) => void
  updateProduct: (product: Product) => void
  removeProduct: (productId: string) => void
  addOrder: (order: Order) => void
  updateOrder: (order: Order) => void
  removeOrder: (orderId: string) => void
  updateOrderStatus: (orderId: string, status: string) => void
  addCustomer: (customer: Customer) => void
  updateCustomer: (customer: Customer) => void
  removeCustomer: (customerId: string) => void
}

const AdminStoreContext = createContext<AdminStoreValue | null>(null)

export function AdminStoreProvider({ children }: PropsWithChildren) {
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS)
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS)
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS)

  const value = useMemo<AdminStoreValue>(
    () => ({
      products,
      orders,
      customers,
      addProduct: (product) => {
        setProducts((prev) => [product, ...prev])
      },
      updateProduct: (product) => {
        setProducts((prev) => prev.map((item) => (item.id === product.id ? product : item)))
      },
      removeProduct: (productId) => {
        setProducts((prev) => prev.filter((item) => item.id !== productId))
      },
      addOrder: (order) => {
        setOrders((prev) => [order, ...prev])
      },
      updateOrder: (order) => {
        setOrders((prev) => prev.map((item) => (item.id === order.id ? order : item)))
      },
      removeOrder: (orderId) => {
        setOrders((prev) => prev.filter((item) => item.id !== orderId))
      },
      updateOrderStatus: (orderId, status) => {
        setOrders((prev) => prev.map((item) => (item.id === orderId ? { ...item, status } : item)))
      },
      addCustomer: (customer) => {
        setCustomers((prev) => [customer, ...prev])
      },
      updateCustomer: (customer) => {
        setCustomers((prev) => prev.map((item) => (item.id === customer.id ? customer : item)))
      },
      removeCustomer: (customerId) => {
        setCustomers((prev) => prev.filter((item) => item.id !== customerId))
      }
    }),
    [products, orders, customers]
  )

  return <AdminStoreContext.Provider value={value}>{children}</AdminStoreContext.Provider>
}

export function useAdminStore() {
  const context = useContext(AdminStoreContext)
  if (!context) {
    throw new Error('useAdminStore must be used within <AdminStoreProvider>.')
  }
  return context
}
