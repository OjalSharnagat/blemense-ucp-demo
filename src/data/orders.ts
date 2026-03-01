export interface Order {
  id: string
  customer: string
  email: string
  items: string[]
  total: number
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  date: string
  address: string
}

export const orders: Order[] = [
  {
    id: 'ord_5001',
    customer: 'Aarav Mehta',
    email: 'aarav.mehta@example.com',
    items: ['Nimbus Running Shoes', 'Nomad Travel Bottle'],
    total: 7998,
    status: 'delivered',
    date: '2026-02-22T10:45:00.000Z',
    address: '14 Lakeview Road, Bengaluru, Karnataka 560034'
  },
  {
    id: 'ord_5002',
    customer: 'Sana Kapoor',
    email: 'sana.kapoor@example.com',
    items: ['Aurora Smart Watch'],
    total: 11999,
    status: 'shipped',
    date: '2026-02-24T09:30:00.000Z',
    address: '77 Green Park, New Delhi, Delhi 110016'
  },
  {
    id: 'ord_5003',
    customer: 'Dev Shah',
    email: 'dev.shah@example.com',
    items: ['Vertex Mechanical Keyboard'],
    total: 7999,
    status: 'processing',
    date: '2026-02-26T14:05:00.000Z',
    address: '12 Navrang Society, Ahmedabad, Gujarat 380009'
  },
  {
    id: 'ord_5004',
    customer: 'Nidhi Rao',
    email: 'nidhi.rao@example.com',
    items: ['Urban Utility Backpack', 'Summit Trail Jacket'],
    total: 13298,
    status: 'pending',
    date: '2026-02-27T18:22:00.000Z',
    address: '5 Hill Crest, Pune, Maharashtra 411001'
  },
  {
    id: 'ord_5005',
    customer: 'Kabir Singh',
    email: 'kabir.singh@example.com',
    items: ['Echo Wireless Earbuds'],
    total: 5499,
    status: 'cancelled',
    date: '2026-02-15T08:00:00.000Z',
    address: '3 Sector 45, Gurgaon, Haryana 122003'
  },
  {
    id: 'ord_5006',
    customer: 'Ishita Nair',
    email: 'ishita.nair@example.com',
    items: ['Craft Ceramic Mug Set'],
    total: 1999,
    status: 'delivered',
    date: '2026-02-12T11:12:00.000Z',
    address: '91 Marine Drive, Mumbai, Maharashtra 400020'
  },
  {
    id: 'ord_5007',
    customer: 'Rohan Verma',
    email: 'rohan.verma@example.com',
    items: ['BrewMate Coffee Grinder', 'Craft Ceramic Mug Set'],
    total: 5598,
    status: 'processing',
    date: '2026-02-23T16:50:00.000Z',
    address: '22 Residency Road, Jaipur, Rajasthan 302001'
  },
  {
    id: 'ord_5008',
    customer: 'Maya Iyer',
    email: 'maya.iyer@example.com',
    items: ['Aurora Smart Watch', 'Echo Wireless Earbuds'],
    total: 17498,
    status: 'shipped',
    date: '2026-02-20T13:15:00.000Z',
    address: '8 Kottur Lane, Chennai, Tamil Nadu 600085'
  },
  {
    id: 'ord_5009',
    customer: 'Arjun Kulkarni',
    email: 'arjun.kulkarni@example.com',
    items: ['Lumen Desk Lamp'],
    total: 2799,
    status: 'pending',
    date: '2026-02-28T07:32:00.000Z',
    address: '48 Baner Road, Pune, Maharashtra 411045'
  },
  {
    id: 'ord_5010',
    customer: 'Pooja Chawla',
    email: 'pooja.chawla@example.com',
    items: ['Summit Trail Jacket'],
    total: 8999,
    status: 'delivered',
    date: '2026-02-10T12:44:00.000Z',
    address: '120 Civil Lines, Kanpur, Uttar Pradesh 208001'
  },
  {
    id: 'ord_5011',
    customer: 'Yash Malhotra',
    email: 'yash.malhotra@example.com',
    items: ['Nimbus Running Shoes'],
    total: 6499,
    status: 'processing',
    date: '2026-02-25T09:03:00.000Z',
    address: '9 Clover Street, Chandigarh 160017'
  },
  {
    id: 'ord_5012',
    customer: 'Ananya Dutta',
    email: 'ananya.dutta@example.com',
    items: ['Urban Utility Backpack', 'Nomad Travel Bottle', 'Craft Ceramic Mug Set'],
    total: 7797,
    status: 'delivered',
    date: '2026-02-18T17:08:00.000Z',
    address: '31 Salt Lake, Kolkata, West Bengal 700091'
  },
  {
    id: 'ord_5013',
    customer: 'Harsh Gupta',
    email: 'harsh.gupta@example.com',
    items: ['Vertex Mechanical Keyboard', 'Echo Wireless Earbuds'],
    total: 13498,
    status: 'shipped',
    date: '2026-02-19T15:27:00.000Z',
    address: '16 Gomti Nagar, Lucknow, Uttar Pradesh 226010'
  },
  {
    id: 'ord_5014',
    customer: 'Neha Bansal',
    email: 'neha.bansal@example.com',
    items: ['BrewMate Coffee Grinder'],
    total: 3599,
    status: 'cancelled',
    date: '2026-02-16T19:22:00.000Z',
    address: '55 Rajpur Road, Dehradun, Uttarakhand 248001'
  },
  {
    id: 'ord_5015',
    customer: 'Rahul Jain',
    email: 'rahul.jain@example.com',
    items: ['Aurora Smart Watch', 'Nimbus Running Shoes'],
    total: 18498,
    status: 'pending',
    date: '2026-02-28T10:12:00.000Z',
    address: '11 C-Scheme, Jaipur, Rajasthan 302005'
  },
  {
    id: 'ord_5016',
    customer: 'Tanya Sethi',
    email: 'tanya.sethi@example.com',
    items: ['Lumen Desk Lamp', 'Craft Ceramic Mug Set'],
    total: 4798,
    status: 'delivered',
    date: '2026-02-14T11:00:00.000Z',
    address: '89 Alkapuri, Vadodara, Gujarat 390007'
  }
]
