import type { ReactNode } from 'react';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ServicesPage from './pages/ServicesPage';
import ProductsPage from './pages/ProductsPage';
import CheckoutPage from './pages/CheckoutPage';
import TransactionsPage from './pages/TransactionsPage';
import ExpensesPage from './pages/ExpensesPage';
import AdminPage from './pages/AdminPage';

interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: 'Login',
    path: '/login',
    element: <LoginPage />,
    visible: false
  },
  {
    name: 'Dashboard',
    path: '/',
    element: <DashboardPage />
  },
  {
    name: 'Services',
    path: '/services',
    element: <ServicesPage />
  },
  {
    name: 'Products',
    path: '/products',
    element: <ProductsPage />
  },
  {
    name: 'Checkout',
    path: '/checkout',
    element: <CheckoutPage />
  },
  {
    name: 'Transactions',
    path: '/transactions',
    element: <TransactionsPage />
  },
  {
    name: 'Expenses',
    path: '/expenses',
    element: <ExpensesPage />
  },
  {
    name: 'Admin',
    path: '/admin',
    element: <AdminPage />
  }
];

export default routes;
