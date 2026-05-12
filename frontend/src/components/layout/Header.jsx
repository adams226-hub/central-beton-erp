import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, ChevronDown, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { ROLE_LABELS, formatDateTime } from '../../utils/formatters';
import { cn } from '../../lib/utils';

const Header = ({ title }) => {
  const { user } = useAuth();
  const { notifications, nonLues, marquerLue, marquerToutesLues } = useNotifications();
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef(null);
  const navigate = useNavigate();

  // Fermer en cliquant dehors
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const TYPE_ICONS = {
    NOUVELLE_COMMANDE: '📋',
    VALIDATION_REQUISE: '⏳',
    COMMANDE_VALIDEE: '✅',
    COMMANDE_REJETEE: '❌',
    FORMULATION_CREEE: '🧪',
    INFO: 'ℹ️',
    ALERTE: '⚠️',
  };

  return (
    <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-gray-800">{title}</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Cloche notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifs((s) => !s)}
            className="relative w-9 h-9 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors"
          >
            <Bell size={17} className="text-gray-600" />
            {nonLues > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold min-w-[18px] px-0.5">
                {nonLues > 9 ? '9+' : nonLues}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifs && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <span className="font-semibold text-gray-800 text-sm">Notifications</span>
                  {nonLues > 0 && (
                    <button onClick={marquerToutesLues} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                      <Check size={12} /> Tout lire
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-8">Aucune notification</p>
                  ) : (
                    notifications.slice(0, 10).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => { marquerLue(n.id); if (n.commandeId) navigate(`/commandes/${n.commandeId}`); setShowNotifs(false); }}
                        className={cn('px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors', !n.isRead && 'bg-blue-50')}
                      >
                        <div className="flex items-start gap-2">
                          <span className="text-base mt-0.5">{TYPE_ICONS[n.type] || 'ℹ️'}</span>
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-xs font-medium text-gray-800', !n.isRead && 'font-semibold')}>
                              {n.message}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(n.createdAt)}</p>
                          </div>
                          {!n.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="px-4 py-2.5 border-t border-gray-100">
                  <button onClick={() => { navigate('/notifications'); setShowNotifs(false); }} className="text-xs text-blue-600 hover:text-blue-800 w-full text-center">
                    Voir toutes les notifications
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profil */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-800 leading-tight">{user?.prenom} {user?.nom}</p>
            <p className="text-xs text-gray-400">{ROLE_LABELS[user?.role]}</p>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
