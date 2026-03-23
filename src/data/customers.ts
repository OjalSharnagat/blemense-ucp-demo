export interface Customer {
  id: string
  name: string
  email: string
  totalOrders: number
  totalSpent: number
  status: 'active' | 'inactive'
  joinedAt: string
  avatar: string
  orderIds?: string[]
  invoiceIds?: string[]
  paymentIds?: string[]
}

export const customers: Customer[] = [
  {
    id: 'cus_9001',
    name: 'Aarav Mehta',
    email: 'aarav.mehta@example.com',
    totalOrders: 9,
    totalSpent: 54890,
    status: 'active',
    joinedAt: '2025-04-08T09:00:00.000Z',
    avatar: 'AM'
  },
  {
    id: 'cus_9002',
    name: 'Sana Kapoor',
    email: 'sana.kapoor@example.com',
    totalOrders: 6,
    totalSpent: 42750,
    status: 'active',
    joinedAt: '2025-05-11T10:00:00.000Z',
    avatar: 'SK'
  },
  {
    id: 'cus_9003',
    name: 'Dev Shah',
    email: 'dev.shah@example.com',
    totalOrders: 4,
    totalSpent: 21980,
    status: 'active',
    joinedAt: '2025-07-02T14:00:00.000Z',
    avatar: 'DS'
  },
  {
    id: 'cus_9004',
    name: 'Nidhi Rao',
    email: 'nidhi.rao@example.com',
    totalOrders: 3,
    totalSpent: 13298,
    status: 'active',
    joinedAt: '2025-08-15T08:30:00.000Z',
    avatar: 'NR'
  },
  {
    id: 'cus_9005',
    name: 'Kabir Singh',
    email: 'kabir.singh@example.com',
    totalOrders: 2,
    totalSpent: 8100,
    status: 'inactive',
    joinedAt: '2025-06-21T16:45:00.000Z',
    avatar: 'KS'
  },
  {
    id: 'cus_9006',
    name: 'Ishita Nair',
    email: 'ishita.nair@example.com',
    totalOrders: 5,
    totalSpent: 17640,
    status: 'active',
    joinedAt: '2025-03-20T07:50:00.000Z',
    avatar: 'IN'
  },
  {
    id: 'cus_9007',
    name: 'Rohan Verma',
    email: 'rohan.verma@example.com',
    totalOrders: 7,
    totalSpent: 30490,
    status: 'active',
    joinedAt: '2025-02-18T12:10:00.000Z',
    avatar: 'RV'
  },
  {
    id: 'cus_9008',
    name: 'Maya Iyer',
    email: 'maya.iyer@example.com',
    totalOrders: 4,
    totalSpent: 28980,
    status: 'active',
    joinedAt: '2025-09-04T15:25:00.000Z',
    avatar: 'MI'
  },
  {
    id: 'cus_9009',
    name: 'Arjun Kulkarni',
    email: 'arjun.kulkarni@example.com',
    totalOrders: 3,
    totalSpent: 11890,
    status: 'inactive',
    joinedAt: '2025-10-30T11:40:00.000Z',
    avatar: 'AK'
  },
  {
    id: 'cus_9010',
    name: 'Pooja Chawla',
    email: 'pooja.chawla@example.com',
    totalOrders: 6,
    totalSpent: 36120,
    status: 'active',
    joinedAt: '2025-01-25T10:30:00.000Z',
    avatar: 'PC'
  },
  {
    id: 'cus_9011',
    name: 'Yash Malhotra',
    email: 'yash.malhotra@example.com',
    totalOrders: 2,
    totalSpent: 12998,
    status: 'active',
    joinedAt: '2025-11-12T13:05:00.000Z',
    avatar: 'YM'
  },
  {
    id: 'cus_9012',
    name: 'Ananya Dutta',
    email: 'ananya.dutta@example.com',
    totalOrders: 8,
    totalSpent: 44760,
    status: 'active',
    joinedAt: '2025-03-01T09:45:00.000Z',
    avatar: 'AD'
  }
]
