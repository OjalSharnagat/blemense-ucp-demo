export interface Product {
  id: string
  name: string
  category: string
  price: number
  stock: number
  status: 'active' | 'draft' | 'archived'
  image: string
  sku: string
  description: string
  createdAt: string
}

export const products: Product[] = [
  {
    id: 'prd_1001',
    name: 'Nimbus Running Shoes',
    category: 'Footwear',
    price: 6499,
    stock: 38,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=80&h=80&fit=crop',
    sku: 'SH-NMB-001',
    description: 'Lightweight performance shoes for daily runs and gym sessions.',
    createdAt: '2025-11-03T10:15:00.000Z'
  },
  {
    id: 'prd_1002',
    name: 'Urban Utility Backpack',
    category: 'Bags',
    price: 4299,
    stock: 54,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=80&h=80&fit=crop',
    sku: 'BG-URB-014',
    description: 'Water-resistant backpack with laptop sleeve and modular pockets.',
    createdAt: '2025-10-18T08:32:00.000Z'
  },
  {
    id: 'prd_1003',
    name: 'Aurora Smart Watch',
    category: 'Wearables',
    price: 11999,
    stock: 21,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=80&h=80&fit=crop',
    sku: 'WR-AUR-022',
    description: 'AMOLED smartwatch with health tracking and 7-day battery.',
    createdAt: '2025-09-12T12:05:00.000Z'
  },
  {
    id: 'prd_1004',
    name: 'BrewMate Coffee Grinder',
    category: 'Home Appliances',
    price: 3599,
    stock: 12,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=80&h=80&fit=crop',
    sku: 'HM-BRW-110',
    description: 'Compact burr grinder with adjustable grind settings.',
    createdAt: '2025-08-27T14:40:00.000Z'
  },
  {
    id: 'prd_1005',
    name: 'Vertex Mechanical Keyboard',
    category: 'Electronics',
    price: 7999,
    stock: 17,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?w=80&h=80&fit=crop',
    sku: 'EL-VTX-381',
    description: 'Hot-swappable keyboard with tactile switches and RGB lighting.',
    createdAt: '2025-12-01T09:55:00.000Z'
  },
  {
    id: 'prd_1006',
    name: 'Nomad Travel Bottle',
    category: 'Accessories',
    price: 1499,
    stock: 95,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1523362628745-0c100150b504?w=80&h=80&fit=crop',
    sku: 'AC-NMD-905',
    description: 'Insulated stainless steel bottle that keeps drinks cold for 24 hours.',
    createdAt: '2025-07-09T07:20:00.000Z'
  },
  {
    id: 'prd_1007',
    name: 'Lumen Desk Lamp',
    category: 'Home Decor',
    price: 2799,
    stock: 0,
    status: 'draft',
    image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?w=80&h=80&fit=crop',
    sku: 'HD-LMN-073',
    description: 'Minimal LED desk lamp with warm and cool brightness presets.',
    createdAt: '2025-10-03T16:10:00.000Z'
  },
  {
    id: 'prd_1008',
    name: 'Summit Trail Jacket',
    category: 'Apparel',
    price: 8999,
    stock: 6,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=80&h=80&fit=crop',
    sku: 'AP-SMT-511',
    description: 'Windproof outer shell built for trekking and cold-weather travel.',
    createdAt: '2025-11-19T11:30:00.000Z'
  },
  {
    id: 'prd_1009',
    name: 'Echo Wireless Earbuds',
    category: 'Audio',
    price: 5499,
    stock: 44,
    status: 'archived',
    image: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?w=80&h=80&fit=crop',
    sku: 'AU-ECH-240',
    description: 'Compact earbuds with ANC and low-latency connectivity.',
    createdAt: '2025-06-21T13:42:00.000Z'
  },
  {
    id: 'prd_1010',
    name: 'Craft Ceramic Mug Set',
    category: 'Kitchen',
    price: 1999,
    stock: 29,
    status: 'active',
    image: 'https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?w=80&h=80&fit=crop',
    sku: 'KT-CRF-672',
    description: 'Set of four handcrafted ceramic mugs for daily coffee rituals.',
    createdAt: '2025-09-29T06:18:00.000Z'
  }
]
