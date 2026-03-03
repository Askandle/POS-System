-- Create user role enum
CREATE TYPE public.user_role AS ENUM ('staff', 'admin');

-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'staff',
  created_at timestamptz DEFAULT now()
);

-- Create services table
CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  base_price numeric(10,2) NOT NULL,
  unit text NOT NULL, -- e.g., 'per page', 'per item', 'per hour'
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(10,2) NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0,
  category text NOT NULL, -- e.g., 'mouse', 'keyboard', 'accessories'
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number text UNIQUE NOT NULL,
  staff_id uuid REFERENCES public.profiles(id) NOT NULL,
  transaction_type text NOT NULL, -- 'service' or 'product'
  total_amount numeric(10,2) NOT NULL,
  payment_method text NOT NULL, -- 'cash', 'card', 'mobile'
  status text NOT NULL DEFAULT 'completed', -- 'completed', 'refunded'
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create transaction items table
CREATE TABLE public.transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
  item_type text NOT NULL, -- 'service' or 'product'
  item_id uuid NOT NULL, -- references services.id or products.id
  item_name text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  subtotal numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid REFERENCES public.profiles(id) NOT NULL,
  category text NOT NULL, -- 'supplies', 'utilities', 'maintenance', 'other'
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_notes text,
  created_at timestamptz DEFAULT now()
);

-- Create function to sync auth users to profiles
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count int;
  extracted_username text;
BEGIN
  SELECT COUNT(*) INTO user_count FROM profiles;
  
  -- Extract username from email (remove @miaoda.com)
  extracted_username := REPLACE(NEW.email, '@miaoda.com', '');
  
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    extracted_username,
    CASE WHEN user_count = 0 THEN 'admin'::public.user_role ELSE 'staff'::public.user_role END
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user sync
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL)
  EXECUTE FUNCTION handle_new_user();

-- Create helper function to check admin role
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = uid AND p.role = 'admin'::user_role
  );
$$;

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Admins have full access to profiles" ON profiles
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can view all profiles" ON profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update their own profile except role" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM (SELECT role FROM profiles WHERE id = auth.uid()));

-- Services policies (all staff can view, only admin can modify)
CREATE POLICY "All authenticated users can view services" ON services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage services" ON services
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Products policies (all staff can view, only admin can modify)
CREATE POLICY "All authenticated users can view products" ON products
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage products" ON products
  FOR ALL TO authenticated USING (is_admin(auth.uid()));

-- Transactions policies (staff can create and view their own, admin can view all)
CREATE POLICY "Staff can create transactions" ON transactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = staff_id);

CREATE POLICY "Staff can view their own transactions" ON transactions
  FOR SELECT TO authenticated USING (auth.uid() = staff_id);

CREATE POLICY "Admins can view all transactions" ON transactions
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update transactions" ON transactions
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

-- Transaction items policies
CREATE POLICY "Staff can create transaction items" ON transaction_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM transactions WHERE id = transaction_id AND staff_id = auth.uid())
  );

CREATE POLICY "Staff can view their transaction items" ON transaction_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM transactions WHERE id = transaction_id AND staff_id = auth.uid())
  );

CREATE POLICY "Admins can view all transaction items" ON transaction_items
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

-- Expenses policies (staff can create and view their own, admin can view all)
CREATE POLICY "Staff can create expenses" ON expenses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = staff_id);

CREATE POLICY "Staff can view their own expenses" ON expenses
  FOR SELECT TO authenticated USING (auth.uid() = staff_id);

CREATE POLICY "Admins can view all expenses" ON expenses
  FOR SELECT TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update expenses" ON expenses
  FOR UPDATE TO authenticated USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete expenses" ON expenses
  FOR DELETE TO authenticated USING (is_admin(auth.uid()));

-- Insert initial services
INSERT INTO public.services (name, description, base_price, unit) VALUES
  ('Printing (B&W)', 'Black and white printing service', 0.50, 'per page'),
  ('Printing (Color)', 'Color printing service', 1.50, 'per page'),
  ('Photocopy (B&W)', 'Black and white photocopying', 0.30, 'per page'),
  ('Photocopy (Color)', 'Color photocopying', 1.00, 'per page'),
  ('Lamination (A4)', 'A4 size lamination', 2.00, 'per item'),
  ('Lamination (A3)', 'A3 size lamination', 3.50, 'per item'),
  ('Scanning', 'Document scanning service', 1.00, 'per page'),
  ('Online Application', 'Assistance with online applications', 5.00, 'per application'),
  ('T-Shirt Customization', 'Custom t-shirt printing', 15.00, 'per item'),
  ('Jersey Customization', 'Custom jersey printing', 25.00, 'per item'),
  ('E-zwitch Transaction', 'E-zwitch payment processing', 1.00, 'per transaction');

-- Insert initial products
INSERT INTO public.products (name, description, price, stock_quantity, category) VALUES
  ('Wireless Mouse', 'Ergonomic wireless mouse', 15.00, 20, 'mouse'),
  ('Gaming Mouse', 'High-precision gaming mouse', 35.00, 10, 'mouse'),
  ('Standard Keyboard', 'USB wired keyboard', 20.00, 15, 'keyboard'),
  ('Mechanical Keyboard', 'RGB mechanical gaming keyboard', 75.00, 8, 'keyboard'),
  ('USB Flash Drive 32GB', '32GB USB 3.0 flash drive', 12.00, 30, 'accessories'),
  ('USB Flash Drive 64GB', '64GB USB 3.0 flash drive', 20.00, 25, 'accessories'),
  ('HDMI Cable', '2m HDMI cable', 8.00, 15, 'accessories'),
  ('USB-C Cable', '1.5m USB-C charging cable', 6.00, 20, 'accessories'),
  ('Webcam', 'HD 1080p webcam', 45.00, 5, 'accessories'),
  ('Headset', 'Gaming headset with microphone', 40.00, 12, 'accessories');