import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Bell, CheckCircle, RefreshCw, Shield, BellOff,
  Package, Wrench, CreditCard, TrendingDown, BarChart3, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { alertesAPI } from '../api';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatDate } from '../utils/formatters';
import { cn } from '../lib/utils';

const NIVEAU_CFG = {
  CRITIQUE: {
    color: 'bg-red-100 text-red-800 border-red-300',
    dot: 'bg-red-500',
    badge: 'bg-red-100 text-red-700',
    label: 'Critique',
    icon: AlertTriangle,
  },
  AVERTISSEMENT: {
    color: 'bg-amber-100 text-amber-800 border-amber-300',
    dot: 'bg-amber-500',
    badge: 'bg-amber-100 text-amber-700',
    label: 'Avertissement',
    icon: AlertTriangle,
  },
  INFO: {
    color: 'bg-blue-50 text-blue-800 border-blue-200',
    dot: 'bg-blue-500',
    badge: 'bg-blue-100 text-blue-700',
    label: 'Information',
    icon: Bell,
  },
};

const TYPE_ICONS = {
  STOCK_FAIBLE: Package,
  STOCK_CRITIQUE: Package,
  PAIEMENT_RETARD: CreditCard,
  EQUIPEMENT_REVISION: Wrench,
  EQUIPEMENT_PANNE: Wrench,
  MARGE_FAIBLE: TrendingDown,
  PRODUCTION_ANOMALIE: BarChart3,
  CONSOMMATION_ANORMALE: Zap,
  CLIENT_IMPAYE: CreditCard,
  BUDGET_DEPASSE: BarChart3,
};

const AlerteCard = ({ alerte, onResoudre, loading }) => {
  const cfg = NIVEAU_CFG[alerte.niveau] || NIVEAU_CFG.INFO;
  const TypeIcon = TYPE_ICONS[alerte.type] || Bell;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10, height: 0, marginBottom: 0 }}
      layout
      className={cn('border rounded-xl p-4', cfg.color, alerte.resolu && 'opacity-50')}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-white/60 flex items-center justify-center">
          <TypeIcon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm">{alerte.titre}</p>
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg.badge)}>
              <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1', cfg.dot)} />
              {cfg.label}
            </span>
            {alerte.resolu && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle size={10} /> Résolu
              </span>
            )}
          </div>
          <p className="text-sm mt-1 opacity-90">{alerte.message}</p>
          <p className="text-xs opacity-60 mt-1.5">{formatDate(alerte.createdAt)}</p>
        </div>
        {!alerte.resolu && (
          <button
            onClick={() => onResoudre(alerte.id)}
            disabled={loading}
            className="flex-shrink-0 text-xs bg-white/70 hover:bg-white px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            <CheckCircle size={12} /> Résoudre
          </button>
        )}
      </div>
    </motion.div>
  );
};

const Alertes = () => {
  const qc = useQueryClient();
  const [filtre, setFiltre] = useState('actives'); // 'actives' | 'resolues' | 'tout'
  const [niveauFiltre, setNiveauFiltre] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['alertes', filtre, niveauFiltre],
    queryFn: () => alertesAPI.lister({
      resolu: filtre === 'actives' ? 'false' : filtre === 'resolues' ? 'true' : undefined,
      niveau: niveauFiltre || undefined,
    }),
    select: (r) => r.data.data,
    refetchInterval: 30000,
  });

  const { mutate: generer, isLoading: generating } = useMutation({
    mutationFn: () => alertesAPI.generer(),
    onSuccess: (res) => {
      const n = res.data.data.generees;
      toast.success(n > 0 ? `${n} nouvelle(s) alerte(s) générée(s)` : 'Aucune nouvelle alerte détectée');
      qc.invalidateQueries(['alertes']);
    },
    onError: () => toast.error('Erreur lors de la génération'),
  });

  const { mutate: resoudre, isLoading: resolving } = useMutation({
    mutationFn: (id) => alertesAPI.resoudre(id),
    onSuccess: () => {
      toast.success('Alerte résolue');
      qc.invalidateQueries(['alertes']);
    },
    onError: () => toast.error('Erreur'),
  });

  const { mutate: resoudreTout } = useMutation({
    mutationFn: () => alertesAPI.resoudreTout(),
    onSuccess: () => {
      toast.success('Toutes les alertes résolues');
      qc.invalidateQueries(['alertes']);
    },
  });

  if (isLoading) return <PageLoader />;

  const stats = data?.stats || {};
  const alertes = data?.alertes || [];
  const totalActives = (stats.critiques || 0) + (stats.avertissements || 0) + (stats.infos || 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Shield size={22} className="text-blue-600" /> Alertes intelligentes
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Surveillance automatique · Actualisé toutes les 30s</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => generer()}
            disabled={generating}
            className="flex items-center gap-2 text-sm bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-60"
          >
            <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
            {generating ? 'Analyse...' : 'Analyser maintenant'}
          </button>
          {totalActives > 0 && (
            <button
              onClick={() => resoudreTout()}
              className="flex items-center gap-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg font-medium"
            >
              <BellOff size={14} /> Tout résoudre
            </button>
          )}
        </div>
      </div>

      {/* KPIs alertes */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Critiques', value: stats.critiques || 0, color: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
          { label: 'Avertissements', value: stats.avertissements || 0, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
          { label: 'Informations', value: stats.infos || 0, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-400' },
          { label: 'Résolues', value: stats.resolues || 0, color: 'text-green-700', bg: 'bg-green-50 border-green-200', dot: 'bg-green-500' },
        ].map(({ label, value, color, bg, dot }) => (
          <div key={label} className={cn('amp-stat-card border', bg)}>
            <div className="flex items-center gap-2">
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dot, value > 0 && label !== 'Résolues' ? 'animate-pulse' : '')} />
              <p className="text-sm text-gray-600">{label}</p>
            </div>
            <p className={cn('text-2xl font-extrabold mt-1', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          {[['actives', 'Actives'], ['resolues', 'Résolues'], ['tout', 'Toutes']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltre(v)} className={cn('px-3 py-2 text-sm font-medium', filtre === v ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
              {l}
            </button>
          ))}
        </div>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          {[['', 'Tous niveaux'], ['CRITIQUE', '🔴 Critique'], ['AVERTISSEMENT', '🟡 Avertissement'], ['INFO', '🔵 Info']].map(([v, l]) => (
            <button key={v} onClick={() => setNiveauFiltre(v)} className={cn('px-3 py-2 text-sm font-medium', niveauFiltre === v ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Liste alertes */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {alertes.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="amp-card p-12 text-center">
              <CheckCircle size={36} className="mx-auto mb-3 text-green-400" />
              <p className="text-gray-600 font-medium">Aucune alerte{filtre === 'actives' ? ' active' : ''}</p>
              <p className="text-gray-400 text-sm mt-1">Le système surveille automatiquement les stocks, paiements et équipements</p>
              <button
                onClick={() => generer()}
                disabled={generating}
                className="mt-4 text-sm text-blue-600 hover:text-blue-800 underline disabled:opacity-50"
              >
                Lancer une analyse maintenant
              </button>
            </motion.div>
          )}
          {alertes.map((alerte) => (
            <AlerteCard
              key={alerte.id}
              alerte={alerte}
              onResoudre={resoudre}
              loading={resolving}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Info système */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1">
        <p className="font-semibold text-gray-600">Ce que le système surveille automatiquement :</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1 mt-1">
          {[
            '📦 Niveaux de stock vs seuils',
            '💳 Paiements en retard (+30j)',
            '🔧 Révisions équipements',
            '⚠ Pannes équipements',
            '📉 Marges sous 10%',
            '💰 Clients impayés',
          ].map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Alertes;
