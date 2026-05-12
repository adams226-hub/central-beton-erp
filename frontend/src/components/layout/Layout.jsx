import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Sidebar from './Sidebar';
import Header from './Header';
import { NotificationProvider } from '../../contexts/NotificationContext';

const PAGE_TITLES = {
  '/dashboard': 'Tableau de bord',
  '/commandes': 'Gestion des commandes',
  '/formulations': 'Formulations béton',
  '/notifications': 'Notifications',
  '/utilisateurs': 'Gestion utilisateurs',
  '/rapports': 'Rapports & Exports',
};

const Layout = () => {
  const location = useLocation();
  const title = Object.entries(PAGE_TITLES).find(([path]) => location.pathname.startsWith(path))?.[1] || 'AMP BÉTON ERP';

  return (
    <NotificationProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header title={title} />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto page-enter">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' },
          success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
          error: { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
        }}
      />
    </NotificationProvider>
  );
};

export default Layout;
