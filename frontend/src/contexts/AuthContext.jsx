import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../api';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) { setLoading(false); return; }
    try {
      const { data } = await authAPI.me();
      setUser(data.data);
      setIsAuthenticated(true);
    } catch {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const { data } = await authAPI.login({ email, password });
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    setUser(data.data.user);
    setIsAuthenticated(true);
    return data.data.user;
  };

  const logout = async () => {
    try { await authAPI.logout(); } catch {}
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setIsAuthenticated(false);
    toast.success('Déconnexion réussie');
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    const permissions = {
      PDG: [
        'commande:read', 'commande:create', 'commande:update', 'commande:validate', 'commande:reject', 'commande:delete',
        'formulation:read', 'formulation:create', 'formulation:update', 'formulation:delete',
        'user:read', 'user:create', 'user:update',
        'stock:read', 'stock:write',
        'production:read', 'production:write',
        'equipement:read', 'equipement:write',
        'livraison:read', 'livraison:write',
        'paiement:read', 'paiement:write',
        'rapport:read', 'rapport:export',
        'dashboard:read',
      ],
      SECRETAIRE: [
        'commande:read', 'commande:create', 'commande:update', 'commande:validate',
        'formulation:read',
        'stock:read', 'production:read', 'livraison:read',
        'paiement:read', 'paiement:write',
        'dashboard:read',
      ],
      CHEF_DE_SITE: [
        'commande:read', 'commande:validate', 'commande:reject',
        'formulation:read', 'formulation:create', 'formulation:update',
        'stock:read', 'stock:write',
        'production:read', 'production:write',
        'equipement:read', 'equipement:write',
        'livraison:read', 'livraison:write',
        'paiement:read',
        'rapport:read', 'dashboard:read',
      ],
      ASSISTANT_COMPTABLE: [
        'commande:read', 'commande:validate', 'commande:reject',
        'formulation:read',
        'stock:read', 'production:read', 'livraison:read',
        'paiement:read', 'paiement:write',
        'rapport:read', 'dashboard:read',
      ],
      CHEF_COMPTABLE: [
        'commande:read', 'commande:validate', 'commande:reject',
        'formulation:read',
        'stock:read', 'production:read', 'livraison:read',
        'paiement:read', 'paiement:write',
        'rapport:read', 'rapport:export', 'dashboard:read',
      ],
      COMPTABLE: [
        'commande:read', 'formulation:read',
        'stock:read', 'production:read', 'equipement:read', 'livraison:read',
        'paiement:read', 'paiement:write',
        'rapport:read', 'rapport:export', 'dashboard:read',
      ],
      OPERATEUR: [
        'commande:read',
        'production:read', 'production:write',
        'livraison:read', 'livraison:write',
        'stock:read', 'equipement:read',
        'dashboard:read',
      ],
    };
    return permissions[user.role]?.includes(permission) ?? false;
  };

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être dans AuthProvider');
  return ctx;
};
