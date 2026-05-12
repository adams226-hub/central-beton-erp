import React from 'react';
import { motion } from 'framer-motion';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../contexts/NotificationContext';
import { formatDateTime } from '../utils/formatters';
import { cn } from '../lib/utils';

const TYPE_CONFIG = {
  NOUVELLE_COMMANDE: { emoji: '📋', label: 'Nouvelle commande', color: 'border-blue-200 bg-blue-50' },
  VALIDATION_REQUISE: { emoji: '⏳', label: 'Validation requise', color: 'border-amber-200 bg-amber-50' },
  COMMANDE_VALIDEE: { emoji: '✅', label: 'Commande validée', color: 'border-green-200 bg-green-50' },
  COMMANDE_REJETEE: { emoji: '❌', label: 'Commande rejetée', color: 'border-red-200 bg-red-50' },
  FORMULATION_CREEE: { emoji: '🧪', label: 'Formulation créée', color: 'border-purple-200 bg-purple-50' },
  INFO: { emoji: 'ℹ️', label: 'Information', color: 'border-gray-200 bg-gray-50' },
  ALERTE: { emoji: '⚠️', label: 'Alerte', color: 'border-orange-200 bg-orange-50' },
};

const Notifications = () => {
  const { notifications, nonLues, marquerLue, marquerToutesLues } = useNotifications();
  const navigate = useNavigate();

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800">Toutes les notifications</h2>
          {nonLues > 0 && <p className="text-sm text-gray-500">{nonLues} non lue{nonLues > 1 ? 's' : ''}</p>}
        </div>
        {nonLues > 0 && (
          <button onClick={marquerToutesLues} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
            <CheckCheck size={15} /> Tout marquer comme lu
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell size={40} className="mx-auto mb-3 text-gray-200" />
          <p className="text-gray-400">Aucune notification</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => {
            const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.INFO;
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => {
                  marquerLue(n.id);
                  if (n.commandeId) navigate(`/commandes/${n.commandeId}`);
                }}
                className={cn(
                  'p-4 rounded-xl border-l-4 cursor-pointer hover:shadow-sm transition-shadow',
                  config.color,
                  !n.isRead ? 'shadow-sm' : 'opacity-75'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{config.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{config.label}</span>
                        <p className={cn('text-sm text-gray-800 mt-0.5', !n.isRead && 'font-semibold')}>{n.message}</p>
                      </div>
                      {!n.isRead && (
                        <button
                          onClick={(e) => { e.stopPropagation(); marquerLue(n.id); }}
                          className="flex-shrink-0 p-1 hover:bg-white/70 rounded-full"
                          title="Marquer comme lue"
                        >
                          <Check size={14} className="text-blue-600" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1.5">{formatDateTime(n.createdAt)}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
