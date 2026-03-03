import { supabase } from './supabase';
import type {
  Profile,
  Service,
  Product,
  Transaction,
  TransactionItem,
  TransactionWithItems,
  Expense,
  DashboardStats,
  PaymentMethod,
  ExpenseCategory
} from '@/types';

// Profile API
export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function updateProfileRole(userId: string, role: 'staff' | 'admin'): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  if (error) throw error;
}

// Services API
export async function getAllServices(): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('name');

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function createService(service: {
  name: string;
  description?: string;
  base_price: number;
  unit: string;
}): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .insert({
      name: service.name,
      description: service.description || null,
      base_price: service.base_price,
      unit: service.unit,
      active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateService(id: string, updates: Partial<Service>): Promise<void> {
  const { error } = await supabase
    .from('services')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase
    .from('services')
    .update({ active: false })
    .eq('id', id);

  if (error) throw error;
}

// Products API
export async function getAllProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .order('category', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function updateProduct(id: string, updates: Partial<Product>): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function createProduct(product: {
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  category: string;
  image_url?: string;
}): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .insert({
      name: product.name,
      description: product.description || null,
      price: product.price,
      stock_quantity: product.stock_quantity,
      category: product.category,
      image_url: product.image_url || null,
      active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ active: false })
    .eq('id', id);

  if (error) throw error;
}

export async function getLowStockProducts(threshold = 10): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('active', true)
    .lte('stock_quantity', threshold)
    .order('stock_quantity', { ascending: true });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// Transactions API
export async function createTransaction(
  staffId: string,
  transactionType: 'service' | 'product',
  totalAmount: number,
  paymentMethod: PaymentMethod,
  items: Array<{
    item_type: 'service' | 'product';
    item_id: string;
    item_name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }>,
  notes?: string
): Promise<string> {
  // Generate transaction number
  const transactionNumber = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

  // Create transaction
  const { data: transaction, error: txError } = await supabase
    .from('transactions')
    .insert({
      transaction_number: transactionNumber,
      staff_id: staffId,
      transaction_type: transactionType,
      total_amount: totalAmount,
      payment_method: paymentMethod,
      status: 'completed',
      notes: notes || null
    })
    .select()
    .single();

  if (txError) throw txError;

  // Create transaction items
  const itemsWithTxId = items.map(item => ({
    ...item,
    transaction_id: transaction.id
  }));

  const { error: itemsError } = await supabase
    .from('transaction_items')
    .insert(itemsWithTxId);

  if (itemsError) throw itemsError;

  // Update product stock if applicable
  for (const item of items) {
    if (item.item_type === 'product') {
      const { error: stockError } = await supabase.rpc('decrement_product_stock', {
        product_id: item.item_id,
        quantity: item.quantity
      });
      
      if (stockError) {
        // If RPC doesn't exist, update manually
        const { data: product } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.item_id)
          .single();
        
        if (product) {
          await supabase
            .from('products')
            .update({ stock_quantity: product.stock_quantity - item.quantity })
            .eq('id', item.item_id);
        }
      }
    }
  }

  return transaction.id;
}

export async function getTransactions(limit = 50): Promise<TransactionWithItems[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      staff:profiles!transactions_staff_id_fkey(id, username, role),
      items:transaction_items(*)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function getTransactionById(id: string): Promise<TransactionWithItems | null> {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      staff:profiles!transactions_staff_id_fkey(id, username, role),
      items:transaction_items(*)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Expenses API
export async function createExpense(
  staffId: string,
  category: ExpenseCategory,
  description: string,
  amount: number,
  expenseDate: string,
  receiptNotes?: string
): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .insert({
      staff_id: staffId,
      category,
      description,
      amount,
      expense_date: expenseDate,
      receipt_notes: receiptNotes || null
    });

  if (error) throw error;
}

export async function getExpenses(limit = 50): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      staff:profiles!expenses_staff_id_fkey(id, username, role)
    `)
    .order('expense_date', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Dashboard API
export async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date().toISOString().split('T')[0];

  // Get today's transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('total_amount')
    .gte('created_at', today)
    .eq('status', 'completed');

  const todaySales = transactions?.reduce((sum, tx) => sum + Number(tx.total_amount), 0) || 0;
  const todayTransactions = transactions?.length || 0;

  // Get today's expenses
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount')
    .eq('expense_date', today);

  const todayExpenses = expenses?.reduce((sum, exp) => sum + Number(exp.amount), 0) || 0;

  // Get low stock products
  const { data: lowStock } = await supabase
    .from('products')
    .select('id')
    .eq('active', true)
    .lte('stock_quantity', 10);

  const lowStockProducts = lowStock?.length || 0;

  return {
    todaySales,
    todayTransactions,
    todayExpenses,
    lowStockProducts
  };
}

// Get transactions by date range
export async function getTransactionsByDateRange(startDate: string, endDate: string): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      staff:profiles!transactions_staff_id_fkey(id, username, role)
    `)
    .gte('created_at', startDate)
    .lte('created_at', endDate)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

// Get expenses by date range
export async function getExpensesByDateRange(startDate: string, endDate: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      staff:profiles!expenses_staff_id_fkey(id, username, role)
    `)
    .gte('expense_date', startDate)
    .lte('expense_date', endDate)
    .order('expense_date', { ascending: false });

  if (error) throw error;
  return Array.isArray(data) ? data : [];
}
