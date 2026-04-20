import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Layout from './components/Layout';

// Lazy-loaded Pages
const Products = lazy(() => import('./pages/Products'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const Stores = lazy(() => import('./pages/Stores'));
const StoreDetails = lazy(() => import('./pages/StoreDetails'));
const Riders = lazy(() => import('./pages/Riders'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Payments = lazy(() => import('./pages/Payments'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Images = lazy(() => import('./pages/Images'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: '60vh' }}>
    <Loader2 className="animate-spin" size={48} color="#007bff" />
  </div>
);

const App: React.FC = () => {
  return (
    <Router>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products" element={<Products />} />
            <Route path="/products/:id" element={<ProductDetails />} />
            <Route path="/stores" element={<Stores />} />
            <Route path="/stores/:id" element={<StoreDetails />} />
            <Route path="/riders" element={<Riders />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/payments" element={<Payments />} />
            <Route path="/images" element={<Images />} />
            <Route path="*" element={<Navigate to="/products" replace />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
};

export default App;
