import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, TrendingDown, DollarSign, Factory, Package, Truck,
  Users, AlertTriangle, RefreshCw, ChevronUp, ChevronDown, Activity,
  CreditCard, BarChart3, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { rapportsAPI, paiementsAPI } from '../api';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatMontant, formatDate } from '../utils/formatters';
import { cn } from '../lib/utils';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#84CC16'];

// Formateur tooltip FCFA
const TooltipFCFA = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name} : {typeof p.value === 'number' && p.value > 10000 ? formatMontant(p.value) : p.value?.toLocaleString('fr-FR')}</p>
      ))}
    </div>
  );
};

const KPICard = ({ label, value, sub, icon: Icon, color, evolution, bg }) => {
  const isPositive = evolution >= 0;
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={cn('amp-card p-5', bg)}>
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className={cn('text-2xl font-extrabold mt-1', color)}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
          <Icon size={20} className={color} />
        </div>
      </div>
      {evolution !== undefined && (
        <div className={cn('flex items-center gap-1 mt-3 text-xs font-medium', isPositive ? 'text-green-600' : 'text-red-600')}>
          {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {Math.abs(evolution).toFixed(1)}% vs mois précédent
        </div>
      )}
    </motion.div>
  );
};

const DashboardPDG = () => {
  const qc = useQueryClient();

  const { data: tableauBord, isLoading, refetch } = useQuery({
    queryKey: ['rapports-pdg'],
    queryFn: () => rapportsAPI.tableauDeBordPDG(),
    select: (r) => r.data.data,
    refetchInterval: 60000,
  });

  const { data: creancesData } = useQuery({
    queryKey: ['paiements-creances'],
    queryFn: () => paiementsAPI.getCreances(),
    select: (r) => r.data.data,
  });

  if (isLoading) return <PageLoader />;

  const mois = tableauBord?.mois || {};
  const ops = tableauBord?.operations || {};
  const stocks = tableauBord?.stocks || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Tableau de bord PDG</h1>
          <p className="text-sm text-gray-400 mt-0.5">Vue exécutive · Mis à jour à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg px-3 py-2 hover:border-blue-300 transition-colors">
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* KPIs Mois */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Ce mois</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Chiffre d'affaires" value={formatMontant(mois.ca)}
            icon={DollarSign} color="text-blue-700"
            bg="bg-blue-50/50"
          />
          <KPICard
            label="Bénéfice net" value={formatMontant(mois.benefice)}
            sub={`Marge : ${mois.tauxMarge?.toFixed(1) || 0}%`} icon={TrendingUp}
            color={(mois.tauxMarge || 0) >= 15 ? 'text-green-700' : 'text-amber-700'}
            bg={(mois.tauxMarge || 0) >= 15 ? 'bg-green-50/50' : 'bg-amber-50/50'}
          />
          <KPICard
            label="Volume béton" value={`${(mois.volumeLivre || 0).toLocaleString('fr-FR')} m³`}
            sub={`${mois.commandes || 0} commande(s)`} icon={Factory} color="text-purple-700"
          />
          <KPICard
            label="Encaissé" value={formatMontant(mois.encaisse)}
            icon={CreditCard} color="text-teal-700"
          />
        </div>
      </div>

      {/* Opérations en cours */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Commandes actives', value: ops.commandesActives, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Livraisons en route', value: ops.livraisonsEnCours, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Paiements en attente', value: ops.paiementsEnAttente, color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Stocks critiques', value: stocks.critiques, color: stocks.critiques > 0 ? 'text-red-700' : 'text-gray-500', bg: stocks.critiques > 0 ? 'bg-red-50' : 'bg-gray-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-xl p-3 text-center', bg)}>
            <p className="text-2xl font-extrabold mt-1">{value ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Créances clients */}
      {creancesData && (
        <div className="amp-card p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" /> Créances clients</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {(creancesData || []).slice(0, 8).map((c) => (
              <div key={c.id} className={cn('flex items-center justify-between text-sm rounded-lg p-2', c.enRetard ? 'bg-red-50' : 'bg-gray-50')}>
                <div>
                  <p className="font-medium text-gray-700">{c.nomClient}</p>
                  <p className="text-xs text-gray-400">{c.reference}</p>
                </div>
                <div className="text-right">
                  <p className={cn('font-bold', c.enRetard ? 'text-red-700' : 'text-gray-800')}>{formatMontant(c.montantRestant)}</p>
                  {c.enRetard && <p className="text-xs text-red-500">En retard</p>}
                </div>
              </div>
            ))}
            {(!creancesData || creancesData.length === 0) && (
              <p className="text-center py-6 text-gray-400 text-sm">Aucune créance en cours</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPDG;
