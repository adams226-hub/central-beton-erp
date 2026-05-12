import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { alertesAPI } from '../../api';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ClipboardList, FlaskConical, Bell, Users,
  ChevronLeft, ChevronRight, Building2,
  Factory, Package, Wrench, Truck, CreditCard, BarChart3,
  Brain, TrendingUp, AlertTriangle, Activity,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { cn } from '../../lib/utils';

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { path: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, permission: null },
      { path: '/dashboard-pdg', label: 'Dashboard PDG', icon: Activity, permission: 'rapport:read' },
    ],
  },
  {
    label: 'Commercial',
    items: [
      { path: '/commandes', label: 'Commandes', icon: ClipboardList, permission: 'commande:read' },
      { path: '/formulations', label: 'Formulations', icon: FlaskConical, permission: 'formulation:read' },
      { path: '/paiements', label: 'Paiements', icon: CreditCard, permission: 'paiement:read' },
    ],
  },
  {
    label: 'Production',
    items: [
      { path: '/production', label: 'Production', icon: Factory, permission: 'production:read' },
      { path: '/stocks', label: 'Stocks', icon: Package, permission: 'stock:read' },
      { path: '/equipements', label: 'Équipements', icon: Wrench, permission: 'equipement:read' },
      { path: '/livraisons', label: 'Livraisons', icon: Truck, permission: 'livraison:read' },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { path: '/analytiques', label: 'Analytiques BI', icon: TrendingUp, permission: 'rapport:read' },
      { path: '/previsions', label: 'Prévisions IA', icon: Brain, permission: 'rapport:read' },
      { path: '/alertes', label: 'Alertes', icon: AlertTriangle, permission: null, alertBadge: true },
      { path: '/rapports', label: 'Rapports', icon: BarChart3, permission: 'rapport:read' },
    ],
  },
  {
    label: 'Système',
    items: [
      { path: '/notifications', label: 'Notifications', icon: Bell, permission: null, badge: true },
      { path: '/utilisateurs', label: 'Utilisateurs', icon: Users, permission: 'user:read' },
    ],
  },
];

// Flatten pour compatibilité avec le reste du code
const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, hasPermission, logout } = useAuth();
  const { nonLues } = useNotifications();

  const { data: alertesData } = useQuery({
    queryKey: ['alertes-count'],
    queryFn: () => alertesAPI.lister({ resolu: 'false', limit: 1 }),
    select: (r) => r.data.data?.stats,
    refetchInterval: 60000,
  });
  const alertesCritiques = (alertesData?.critiques || 0) + (alertesData?.avertissements || 0);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative flex flex-col bg-amp-900 text-white h-screen shadow-xl z-30 flex-shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-amp-800">
        <div className="w-9 h-9 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 size={20} className="text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              className="overflow-hidden whitespace-nowrap"
            >
              <p className="font-bold text-base leading-tight">AMP BÉTON</p>
              <p className="text-amp-300 text-xs">ERP Industriel v3</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation avec groupes */}
      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const visibleItems = group.items.filter((item) => !item.permission || hasPermission(item.permission));
          if (!visibleItems.length) return null;
          return (
            <div key={group.label || 'root'} className="mb-3">
              {group.label && !collapsed && (
                <p className="text-[10px] font-semibold text-amp-500 uppercase px-3 mb-1">{group.label}</p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map(({ path, label, icon: Icon, badge, alertBadge }) => (
                  <NavLink
                    key={path}
                    to={path}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'text-amp-200 hover:bg-amp-800 hover:text-white'
                      )
                    }
                  >
                    <div className="relative flex-shrink-0">
                      <Icon size={18} />
                      {badge && nonLues > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center font-bold">
                          {nonLues > 9 ? '9+' : nonLues}
                        </span>
                      )}
                      {alertBadge && alertesCritiques > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-[9px] flex items-center justify-center font-bold animate-pulse">
                          {alertesCritiques > 9 ? '9+' : alertesCritiques}
                        </span>
                      )}
                    </div>
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          className="overflow-hidden whitespace-nowrap"
                        >
                          {label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Profil utilisateur */}
      <div className="border-t border-amp-800 p-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-sm font-medium truncate">{user?.prenom} {user?.nom}</p>
                <p className="text-amp-400 text-xs truncate">{user?.role?.replace('_', ' ')}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {!collapsed && (
          <button
            onClick={logout}
            className="mt-3 w-full text-left text-xs text-amp-400 hover:text-red-400 transition-colors px-1"
          >
            Déconnexion
          </button>
        )}
      </div>

      {/* Toggle bouton */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-8 w-6 h-6 bg-amp-800 border border-amp-700 rounded-full flex items-center justify-center text-amp-300 hover:text-white hover:bg-blue-600 transition-colors z-10"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>
    </motion.aside>
  );
};

export default Sidebar;
