export type GSTRateLabel =
  | "NIL"
  | "EXEMPT"
  | "0.1%"
  | "0.25%"
  | "1%"
  | "1.5%"
  | "3%"
  | "5%"
  | "7.5%"
  | "12%"
  | "18%"
  | "28%";

export const GST_RATES: Record<GSTRateLabel, number> = {
  NIL: 0,
  EXEMPT: 0,
  "0.1%": 0.1,
  "0.25%": 0.25,
  "1%": 1,
  "1.5%": 1.5,
  "3%": 3,
  "5%": 5,
  "7.5%": 7.5,
  "12%": 12,
  "18%": 18,
  "28%": 28,
};

export interface HSNCode {
  code: string;
  description: string;
  defaultGstRate: number;
}

export const HSN_CODES: HSNCode[] = [
  { code: "9403", description: "Other furniture and parts (home goods)", defaultGstRate: 18 },
  { code: "7323", description: "Table, kitchen or other household articles of iron/steel", defaultGstRate: 18 },
  { code: "9405", description: "Lamps and lighting fittings", defaultGstRate: 12 },
  { code: "3924", description: "Plastic household and toilet articles", defaultGstRate: 18 },
  { code: "6912", description: "Ceramic tableware, kitchenware and household articles", defaultGstRate: 12 },
  { code: "6302", description: "Bed linen, table linen, toilet and kitchen linen", defaultGstRate: 5 },
  { code: "5703", description: "Carpets and textile floor coverings", defaultGstRate: 12 },
  { code: "7013", description: "Glassware used for table, kitchen or indoor decoration", defaultGstRate: 18 },
  { code: "4818", description: "Toilet paper, tissues, towels and similar household paper", defaultGstRate: 12 },
  { code: "3307", description: "Room deodorizers, perfumed preparations", defaultGstRate: 18 },
  { code: "8509", description: "Electro-mechanical domestic appliances", defaultGstRate: 18 },
  { code: "8516", description: "Electric instantaneous/storage water heaters and heating apparatus", defaultGstRate: 18 },
  { code: "4202", description: "Travel goods, handbags and similar containers", defaultGstRate: 18 },
  { code: "6111", description: "Babies' garments and clothing accessories, knitted/crocheted", defaultGstRate: 12 },
  { code: "6203", description: "Men's or boys' suits, jackets, trousers and similar apparel", defaultGstRate: 12 },
  { code: "6204", description: "Women's or girls' suits, dresses, skirts and similar apparel", defaultGstRate: 12 },
  { code: "9503", description: "Toys, including scale models and puzzles", defaultGstRate: 12 },
  { code: "9506", description: "Sports goods and equipment", defaultGstRate: 12 },
  { code: "8211", description: "Knives with cutting blades and related tools", defaultGstRate: 18 },
  { code: "4421", description: "Other articles of wood", defaultGstRate: 18 },
];

export interface IndianState {
  code: string;
  name: string;
  tinCode: string;
}

export const INDIAN_STATES: IndianState[] = [
  { code: "AN", name: "Andaman and Nicobar Islands", tinCode: "35" },
  { code: "AP", name: "Andhra Pradesh", tinCode: "37" },
  { code: "AR", name: "Arunachal Pradesh", tinCode: "12" },
  { code: "AS", name: "Assam", tinCode: "18" },
  { code: "BR", name: "Bihar", tinCode: "10" },
  { code: "CH", name: "Chandigarh", tinCode: "04" },
  { code: "CG", name: "Chhattisgarh", tinCode: "22" },
  { code: "DN", name: "Dadra and Nagar Haveli and Daman and Diu", tinCode: "26" },
  { code: "DL", name: "Delhi", tinCode: "07" },
  { code: "GA", name: "Goa", tinCode: "30" },
  { code: "GJ", name: "Gujarat", tinCode: "24" },
  { code: "HR", name: "Haryana", tinCode: "06" },
  { code: "HP", name: "Himachal Pradesh", tinCode: "02" },
  { code: "JK", name: "Jammu and Kashmir", tinCode: "01" },
  { code: "JH", name: "Jharkhand", tinCode: "20" },
  { code: "KA", name: "Karnataka", tinCode: "29" },
  { code: "KL", name: "Kerala", tinCode: "32" },
  { code: "LA", name: "Ladakh", tinCode: "38" },
  { code: "LD", name: "Lakshadweep", tinCode: "31" },
  { code: "MP", name: "Madhya Pradesh", tinCode: "23" },
  { code: "MH", name: "Maharashtra", tinCode: "27" },
  { code: "MN", name: "Manipur", tinCode: "14" },
  { code: "ML", name: "Meghalaya", tinCode: "17" },
  { code: "MZ", name: "Mizoram", tinCode: "15" },
  { code: "NL", name: "Nagaland", tinCode: "13" },
  { code: "OD", name: "Odisha", tinCode: "21" },
  { code: "PY", name: "Puducherry", tinCode: "34" },
  { code: "PB", name: "Punjab", tinCode: "03" },
  { code: "RJ", name: "Rajasthan", tinCode: "08" },
  { code: "SK", name: "Sikkim", tinCode: "11" },
  { code: "TN", name: "Tamil Nadu", tinCode: "33" },
  { code: "TS", name: "Telangana", tinCode: "36" },
  { code: "TR", name: "Tripura", tinCode: "16" },
  { code: "UP", name: "Uttar Pradesh", tinCode: "09" },
  { code: "UK", name: "Uttarakhand", tinCode: "05" },
  { code: "WB", name: "West Bengal", tinCode: "19" },
];

// 2-digit state code + 10-char PAN + entity number + Z + checksum
export const GSTIN_REGEX =
  /^([0][1-9]|[1-2][0-9]|3[0-8])[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
