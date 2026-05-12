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
import { analyticsAPI } from '../api';
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
  const [annee, setAnnee] = useState(new Date().getFullYear());

  const { data: kpis, isLoading: loadingKPIs, refetch } = useQuery({
    queryKey: ['analytics-kpis'],
    queryFn: () => analyticsAPI.kpisTempsReel(),
    select: (r) => r.data.data,
    refetchInterval: 60000,
  });

  const { data: tendances, isLoading: loadingTendances } = useQuery({
    queryKey: ['analytics-tendances', annee],
    queryFn: () => analyticsAPI.tendancesMensuelles(annee),
    select: (r) => r.data.data,
  });

  const { data: clientsData } = useQuery({
    queryKey: ['analytics-clients'],
    queryFn: () => analyticsAPI.rentabiliteParClient(),
    select: (r) => r.data.data,
  });

  const { data: betonData } = useQuery({
    queryKey: ['analytics-beton'],
    queryFn: () => analyticsAPI.rentabiliteParTypeBeton(),
    select: (r) => r.data.data,
  });

  const { data: paiementsData } = useQuery({
    queryKey: ['analytics-paiements'],
    queryFn: () => analyticsAPI.analysePaiements(),
    select: (r) => r.data.data,
  });

  if (loadingKPIs) return <PageLoader />;

  const mois = kpis?.mois || {};
  const ops = kpis?.operations || {};
  const stocks = kpis?.stocks || {};
  const aujd = kpis?.aujourdhui || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Tableau de bord PDG</h1>
          <p className="text-sm text-gray-400 mt-0.5">Vue exécutive en temps réel · Mis à jour à {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg px-3 py-2 hover:border-blue-300 transition-colors">
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* KPIs Aujourd'hui */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Aujourd'hui</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard label="CA du jour" value={formatMontant(aujd.ca)} icon={DollarSign} color="text-blue-700" bg="bg-blue-50/50" />
          <KPICard label="Productions" value={aujd.productions} sub={`${aujd.volume?.toLocaleString('fr-FR') || 0} m³`} icon={Factory} color="text-green-700" />
          <KPICard label="Commandes" value={aujd.commandes} icon={BarChart3} color="text-purple-700" />
          <KPICard label="Bénéfice jour" value={formatMontant(aujd.benefice)} icon={TrendingUp} color={aujd.benefice >= 0 ? 'text-green-700' : 'text-red-700'} />
        </div>
      </div>

      {/* KPIs Mois */}
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Ce mois</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPICard
            label="Chiffre d'affaires" value={formatMontant(mois.ca)}
            sub={`Objectif mois`} icon={DollarSign} color="text-blue-700"
            bg="bg-blue-50/50" evolution={mois.evolution}
          />
          <KPICard
            label="Bénéfice net" value={formatMontant(mois.benefice)}
            sub={`Marge : ${mois.tauxMarge?.toFixed(1) || 0}%`} icon={TrendingUp}
            color={mois.tauxMarge >= 15 ? 'text-green-700' : 'text-amber-700'}
            bg={mois.tauxMarge >= 15 ? 'bg-green-50/50' : 'bg-amber-50/50'}
          />
          <KPICard
            label="Volume béton" value={`${(mois.volumeProduit || 0).toLocaleString('fr-FR')} m³`}
            sub={`${mois.productions} production(s)`} icon={Factory} color="text-purple-700"
          />
          <KPICard
            label="Encaissé" value={formatMontant(mois.encaisse)}
            sub={`Gasoil : ${(mois.gasoil || 0).toLocaleString('fr-FR')} L`} icon={CreditCard} color="text-teal-700"
          />
        </div>
      </div>

      {/* Opérations en cours */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Commandes actives', value: ops.commandesActives, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Livraisons en route', value: ops.livraisonsEnCours, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Équipements actifs', value: ops.equipementsActifs, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Paiements en attente', value: ops.paiementsEnAttente, color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Stocks critiques', value: stocks.critiques, color: stocks.critiques > 0 ? 'text-red-700' : 'text-gray-500', bg: stocks.critiques > 0 ? 'bg-red-50' : 'bg-gray-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={cn('rounded-xl p-3 text-center', bg)}>
            <p className="text-2xl font-extrabold mt-1">{value ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Graphiques principaux */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Evolution CA & Bénéfice */}
        <div className="amp-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">Évolution CA & Bénéfice</h3>
            <select value={annee} onChange={(e) => setAnnee(parseInt(e.target.value))} className="text-xs border border-gray-200 rounded-lg px-2 py-1">
              {[2024, 2025, 2026].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {loadingTendances ? <div className="h-56 flex items-center justify-center text-gray-400 text-sm">Chargement...</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={tendances?.tendances || []}>
                <defs>
                  <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradBen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} tick={{ fontSize: 9 }} />
                <Tooltip content={<TooltipFCFA />} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="ca" name="CA" stroke="#3B82F6" fill="url(#gradCA)" strokeWidth={2} />
                <Area type="monotone" dataKey="benefice" name="Bénéfice" stroke="#10B981" fill="url(#gradBen)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Répartition type béton */}
        <div className="amp-card p-5">
          <h3 className="font-bold text-gray-800 mb-4">Répartition par type de béton</h3>
          {!betonData?.length ? (
            <div className="h-56 flex items-center justify-center text-gray-400 text-sm">Aucune donnée</div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={betonData} dataKey="volume" nameKey="type" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                    {betonData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [`${v.toLocaleString('fr-FR')} m³`]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {betonData.map((b, i) => (
                  <div key={b.type} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="font-medium text-gray-700">{b.type}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-gray-800">{b.volume.toLocaleString('fr-FR')} m³</span>
                      <span className="text-xs text-gray-400 ml-2">{b.tauxMarge.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Volume mensuel + Production */}
      <div className="amp-card p-5">
        <h3 className="font-bold text-gray-800 mb-4">Volume production mensuel (m³)</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={tendances?.tendances || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip content={<TooltipFCFA />} />
            <Bar dataKey="volume" name="Volume (m³)" fill="#3B82F6" radius={[4, 4, 0, 0]}>
              {(tendances?.tendances || []).map((_, i) => (
                <Cell key={i} fill={i === new Date().getMonth() ? '#1D4ED8' : '#93C5FD'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top clients + Créances */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Top clients */}
        <div className="amp-card p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Users size={16} className="text-blue-600" /> Top Clients (12 mois)</h3>
          <div className="space-y-2">
            {(clientsData?.clients || []).slice(0, 6).map((c, i) => {
              const maxCA = clientsData?.clients?.[0]?.ca || 1;
              return (
                <div key={c.nom} className="flex items-center gap-3">
                  <span className="w-6 text-xs font-bold text-gray-400">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700 truncate">{c.nom}</span>
                      <span className="text-sm font-bold text-gray-800 ml-2 flex-shrink-0">{formatMontant(c.ca)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(c.ca / maxCA) * 100}%` }} />
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{c.commandes} cmd · Marge {c.tauxMarge.toFixed(1)}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Créances */}
        <div className="amp-card p-5">
          <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" /> Créances clients</h3>
          {paiementsData?.statistiques && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Total créances', value: formatMontant(paiementsData.statistiques.totalCreances), color: 'text-gray-800' },
                { label: 'En retard', value: formatMontant(paiementsData.statistiques.totalEnRetard), color: 'text-red-700' },
                { label: 'Recouvrement', value: `${paiementsData.statistiques.tauxRecouvrement?.toFixed(1)}%`, color: paiementsData.statistiques.tauxRecouvrement >= 80 ? 'text-green-700' : 'text-amber-700' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className={cn('font-bold text-sm', color)}>{value}</p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {(paiementsData?.creances || []).slice(0, 6).map((c) => (
              <div key={c.id} className={cn('flex items-center justify-between text-sm rounded-lg p-2', c.enRetard ? 'bg-red-50' : 'bg-gray-50')}>
                <div>
                  <p className="font-medium text-gray-700">{c.nomClient}</p>
                  <p className="text-xs text-gray-400">{c.reference} · {c.joursDepuisLivraison}j</p>
                </div>
                <div className="text-right">
                  <p className={cn('font-bold', c.enRetard ? 'text-red-700' : 'text-gray-800')}>{formatMontant(c.restant)}</p>
                  {c.enRetard && <p className="text-xs text-red-500">En retard</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPDG;
