import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Commandes from './pages/Commandes';
import CommandeDetail from './pages/CommandeDetail';
import Formulations from './pages/Formulations';
import Notifications from './pages/Notifications';
import { PageLoader } from './components/common/LoadingSpinner';

const Utilisateurs = lazy(() => import('./pages/Utilisateurs'));
const Livraisons = lazy(() => import('./pages/Livraisons'));
const Paiements = lazy(() => import('./pages/Paiements'));
const DashboardPDG = lazy(() => import('./pages/DashboardPDG'));
const Parametres = lazy(() => import('./pages/Parametres'));

const PrivateRoute = ({ children, permission }) => {
  const { isAuthenticated, loading, hasPermission } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(permission)) return (
    <div className="flex items-center justify-center h-64 text-center">
      <div>
        <p className="text-2xl mb-2">🔒</p>
        <p className="text-gray-600 font-medium">Accès refusé</p>
        <p className="text-gray-400 text-sm">Vous n'avez pas les permissions nécessaires</p>
      </div>
    </div>
  );
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
};

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="commandes" element={<PrivateRoute permission="commande:read"><Commandes /></PrivateRoute>} />
          <Route path="commandes/:id" element={<PrivateRoute permission="commande:read"><CommandeDetail /></PrivateRoute>} />
          <Route path="formulations" element={<PrivateRoute permission="formulation:read"><Formulations /></PrivateRoute>} />
          <Route path="livraisons" element={<PrivateRoute permission="livraison:read"><Suspense fallback={<PageLoader />}><Livraisons /></Suspense></PrivateRoute>} />
          <Route path="paiements" element={<PrivateRoute permission="paiement:read"><Suspense fallback={<PageLoader />}><Paiements /></Suspense></PrivateRoute>} />
          <Route path="dashboard-pdg" element={<PrivateRoute permission="rapport:read"><Suspense fallback={<PageLoader />}><DashboardPDG /></Suspense></PrivateRoute>} />
          <Route path="parametres" element={<Suspense fallback={<PageLoader />}><Parametres /></Suspense>} />
          <Route path="utilisateurs" element={<PrivateRoute permission="user:read"><Suspense fallback={<PageLoader />}><Utilisateurs /></Suspense></PrivateRoute>} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  </BrowserRouter>
);

export default App;
