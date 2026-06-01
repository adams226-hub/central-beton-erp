import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import { notificationsAPI } from '../api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [nonLues, setNonLues] = useState(0);
  const [socket, setSocket] = useState(null);

  const chargerNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [notifRes, countRes] = await Promise.all([
        notificationsAPI.lister(),
        notificationsAPI.nonLues(),
      ]);
      setNotifications(notifRes.data.data);
      setNonLues(countRes.data.data.count);
    } catch {}
  }, [isAuthenticated]);

  // Connexion Socket.io
  useEffect(() => {
    if (!isAuthenticated) return;
    const token = localStorage.getItem('accessToken');
    const s = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    s.on('connect', () => {});
    s.on('notification:nouvelle', (notif) => {
      setNotifications((prev) => [notif, ...prev]);
      setNonLues((c) => c + 1);
      toast.custom((t) => (
        <div className={`bg-white border-l-4 border-blue-600 rounded-lg shadow-lg p-4 max-w-sm ${t.visible ? 'animate-fade-in' : 'opacity-0'}`}>
          <p className="font-semibold text-gray-800 text-sm">{notif.titre?.replace(/_/g, ' ')}</p>
          <p className="text-gray-600 text-xs mt-1">{notif.message}</p>
        </div>
      ), { duration: 5000 });
    });

    setSocket(s);
    chargerNotifications();

    return () => s.disconnect();
  }, [isAuthenticated, chargerNotifications]);

  const marquerLue = async (id) => {
    await notificationsAPI.marquerLue(id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setNonLues((c) => Math.max(0, c - 1));
  };

  const marquerToutesLues = async () => {
    await notificationsAPI.marquerToutesLues();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setNonLues(0);
  };

  return (
    <NotificationContext.Provider value={{ notifications, nonLues, marquerLue, marquerToutesLues, chargerNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications doit être dans NotificationProvider');
  return ctx;
};
