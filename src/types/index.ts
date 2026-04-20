export interface DashboardStats {
  total_orders: number;
  total_deliveries: number;
  total_payment_received: number;
  total_to_stores: number;
  total_to_riders: number;
  total_to_admin: number;
  stores_joined: number;
  products_added: number;
}

export type Timeframe = 'daily' | 'weekly' | 'monthly';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  image_url: string | null;
  product_type: string;
  barcode: string | null;
  weight_kg: number | null;
  is_info_complete: boolean;
  needs_changes: boolean;
  store_id: string;
  stores?: {
    name: string;
    id: string;
  };
  raw_image_url?: string | null;
  delivery_vehicle?: 'bike' | 'truck';
  options?: { title: string; values: string[] }[] | null;
  tags?: string[] | null;
  in_stock?: boolean;
  is_deleted?: boolean;
}

export interface SpecItem {
  title: string;
  text: string;
}

export interface Store {
  id: string;
  name: string;
  description: string | null;
  category: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  banner_url: string | null;
  is_active: boolean;
  is_approved: boolean;
  has_pending_changes: boolean;
  created_at: string;
  owner_name: string | null;
  owner_number: string | null;
  upi_id: string | null;
  location_wkt: string | null;
  location?: Record<string, unknown>;
  opening_hours: Record<string, unknown>;
  approved_details?: Record<string, unknown>;
  verification_images: string[] | null;
  whatsapp_number: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
}

export type PayoutType = 'store' | 'rider';

export interface Payout {
  id: string;
  recipient_id: string;
  recipient_type: PayoutType;
  order_id: string;
  amount: number | string;
  payment_date: string;
  status: string;
  upi_transaction_id?: string | null;
  recipient?: {
    name?: string;
    full_name?: string;
    upi_id?: string;
  };
  order?: { order_number: string };
}
