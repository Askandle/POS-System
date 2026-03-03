// User and Profile types
export type UserRole = 'staff' | 'admin';

export interface Profile {
  id: string;
  username: string;
  role: UserRole;
  created_at: string;
}

// Service types
export interface Service {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  unit: string;
  active: boolean;
  created_at: string;
}

// Product types
export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock_quantity: number;
  category: string;
  active: boolean;
  image_url: string | null;
  created_at: string;
}

// Transaction types
export type TransactionType = 'service' | 'product';
export type PaymentMethod = 'cash' | 'card' | 'mobile';
export type TransactionStatus = 'completed' | 'refunded';

export interface Transaction {
  id: string;
  transaction_number: string;
  staff_id: string;
  transaction_type: TransactionType;
  total_amount: number;
  payment_method: PaymentMethod;
  status: TransactionStatus;
  notes: string | null;
  created_at: string;
  staff?: Profile;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  item_type: 'service' | 'product';
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

export interface TransactionWithItems extends Transaction {
  items: TransactionItem[];
}

// Expense types
export type ExpenseCategory = 'supplies' | 'utilities' | 'maintenance' | 'other';

export interface Expense {
  id: string;
  staff_id: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expense_date: string;
  receipt_notes: string | null;
  created_at: string;
  staff?: Profile;
}

// Cart types for checkout
export interface CartItem {
  type: 'service' | 'product';
  id: string;
  name: string;
  price: number;
  quantity: number;
  unit?: string;
  stock?: number;
}

// Dashboard statistics
export interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  todayExpenses: number;
  lowStockProducts: number;
}
