import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { TrendingUp, Users, FlaskConical, Package, Activity, Truck } from 'lucide-react';
import { analyticsAPI } from '../api';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatMontant } from '../utils/formatters';
import { cn } from '../lib/utils';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

const TooltipFCFA = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name} : {typeof p.value === 'number' && p.value > 10000 ? formatMontant(p.value) : (p.value || 0).toLocaleString('fr-FR')}
        </p>
      ))}
    </div>
  );
};

const SectionCard = ({ title, icon: Icon, color = 'text-blue-600', children, className }) => (
  <div className={cn('amp-card overflow-hidden', className)}>
    <div className="px-5 py-4 border-b border-gray-100">
      <h2 className="font-bold text-gray-800 flex items-center gap-2">
        <Icon size={16} className={color} /> {title}
      </h2>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const Analytiques = () => {
  const [moisConso, setMoisConso] = useState(6);

  const { data: clients, isLoading: lcl } = useQuery({
    queryKey: ['analytics-clients-bi'],
    queryFn: () => analyticsAPI.rentabiliteParClient(),
    select: (r) => r.data.data,
  });

  const { data: beton } = useQuery({
    queryKey: ['analytics-beton-bi'],
    queryFn: () => analyticsAPI.rentabiliteParTypeBeton(),
    select: (r) => r.data.data,
  });

  const { data: consommations, isLoading: lco } = useQuery({
    queryKey: ['analytics-conso', moisConso],
    queryFn: () => analyticsAPI.consommationsMatieres(moisConso),
    select: (r) => r.data.data,
  });

  const { data: perf } = useQuery({
    queryKey: ['analytics-perf'],
    queryFn: () => analyticsAPI.performanceProduction(),
    select: (r) => r.data.data,
  });

  const { data: paiements } = useQuery({
    queryKey: ['analytics-paiements-bi'],
    queryFn: () => analyticsAPI.analysePaiements(),
    select: (r) => r.data.data,
  });

  if (lcl) return <PageLoader />;

  // Préparer données radar pour type béton
  const betonRadar = (beton || []).map((b) => ({
    type: b.type,
    Volume: b.volume,
    'CA (k)': Math.round(b.ca / 1000),
    'Marge %': b.tauxMarge,
    Commandes: b.commandes,
  }));

  // Top 8 clients pour le bar chart
  const topClients = (clients?.clients || []).slice(0, 8);

  // Couleurs rupture stock
  const risqueColors = { CRITIQUE: '#EF4444', AVERTISSEMENT: '#F59E0B', OK: '#10B981' };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Business Intelligence</h1>
        <p className="text-sm text-gray-400 mt-0.5">Analyses avancées de rentabilité, production et consommation</p>
      </div>

      {/* KPIs globaux clients */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Clients actifs', value: clients?.total || 0, color: 'text-blue-700' },
          { label: 'CA total clients', value: formatMontant(clients?.caTotal || 0), color: 'text-gray-800' },
          { label: 'Volume total', value: `${(clients?.volumeTotal || 0).toLocaleString('fr-FR')} m³`, color: 'text-purple-700' },
          { label: 'Types béton', value: beton?.length || 0, color: 'text-green-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="amp-stat-card">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={cn('text-xl font-bold mt-1', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Rentabilité par client */}
      <SectionCard title="Rentabilité par client (Top 8)" icon={Users} color="text-blue-600">
        {!topClients.length ? <p className="text-gray-400 text-sm text-center py-8">Aucune donnée disponible</p> : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={topClients} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="nom" tick={{ fontSize: 10 }} width={80} />
              <Tooltip content={<TooltipFCFA />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="ca" name="CA" fill="#3B82F6" radius={[0, 4, 4, 0]}>
                {topClients.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
              <Bar dataKey="benefice" name="Bénéfice" fill="#10B981" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        {/* Table résumé */}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>{['Client', 'Commandes', 'Volume m³', 'CA', 'Bénéfice', 'Marge %', 'Prix/m³'].map((h) => (
                <th key={h} className="text-left px-2 py-2 font-semibold text-gray-500">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {topClients.map((c) => (
                <tr key={c.nom} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-2 py-2 font-medium text-gray-700">{c.nom}</td>
                  <td className="px-2 py-2 text-center">{c.commandes}</td>
                  <td className="px-2 py-2">{c.volume.toLocaleString('fr-FR')}</td>
                  <td className="px-2 py-2 font-bold">{formatMontant(c.ca)}</td>
                  <td className={cn('px-2 py-2 font-bold', c.benefice >= 0 ? 'text-green-700' : 'text-red-700')}>{formatMontant(c.benefice)}</td>
                  <td className={cn('px-2 py-2 font-bold', c.tauxMarge >= 15 ? 'text-green-700' : c.tauxMarge >= 8 ? 'text-amber-700' : 'text-red-600')}>
                    {c.tauxMarge.toFixed(1)}%
                  </td>
                  <td className="px-2 py-2">{formatMontant(c.prixMoyenM3)}/m³</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Rentabilité par type béton + Performance */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <SectionCard title="Analyse par type de béton" icon={FlaskConical} color="text-purple-600">
          {!betonRadar.length ? <p className="text-center text-gray-400 text-sm py-8">Aucune donnée</p> : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={beton || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="type" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip content={<TooltipFCFA />} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="volume" name="Volume (m³)" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="tauxMarge" name="Marge %" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {(beton || []).map((b) => (
                  <div key={b.type} className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-xs font-bold text-gray-700">{b.type}</p>
                    <p className="text-sm font-extrabold text-purple-700">{b.volume.toLocaleString('fr-FR')} m³</p>
                    <p className="text-xs text-gray-400">{formatMontant(b.prixMoyenM3)}/m³</p>
                    <p className={cn('text-xs font-bold', b.tauxMarge >= 15 ? 'text-green-600' : 'text-amber-600')}>{b.tauxMarge.toFixed(1)}% marge</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>

        {/* Performance opérateurs */}
        <SectionCard title="Performance production & opérateurs" icon={Activity} color="text-green-600">
          {perf?.global && (
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: 'Productions', value: perf.global.productions },
                { label: 'Rendement', value: `${perf.global.rendementMoyen?.toFixed(1) || 0}%` },
                { label: 'Écart vol.', value: `${perf.global.ecartVolume?.toFixed(1) || 0} m³` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="font-bold text-gray-800">{value}</p>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {(perf?.operateurs || []).map((op, i) => (
              <div key={op.nom} className="flex items-center gap-3 bg-gray-50 rounded-lg p-2.5">
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center font-bold">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700">{op.nom}</p>
                  <p className="text-xs text-gray-400">{op.productions} prod · {op.volumeReel?.toFixed(1)} m³</p>
                </div>
                <div className="text-right">
                  <p className={cn('text-sm font-bold', op.rendement >= 95 ? 'text-green-700' : op.rendement >= 80 ? 'text-amber-700' : 'text-red-600')}>
                    {op.rendement?.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400">{op.productiviteM3H?.toFixed(2)} m³/h</p>
                </div>
              </div>
            ))}
            {!perf?.operateurs?.length && <p className="text-center text-gray-400 text-sm py-4">Aucune donnée</p>}
          </div>
          {/* Chauffeurs */}
          {(perf?.chauffeurs || []).length > 0 && (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase mt-4 mb-2">Performance chauffeurs</p>
              <div className="space-y-1.5">
                {perf.chauffeurs.slice(0, 4).map((c) => (
                  <div key={c.nom} className="flex items-center justify-between text-sm bg-green-50 rounded-lg px-3 py-2">
                    <span className="font-medium text-gray-700"><Truck size={10} className="inline mr-1" />{c.nom}</span>
                    <span className="text-xs text-gray-500">{c.livraisons} liv · {c.dureeMoyenne} min moy.</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      </div>

      {/* Consommations matières */}
      <SectionCard title="Consommation matières par mois" icon={Package} color="text-amber-600">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            {[3, 6, 12].map((m) => (
              <button key={m} onClick={() => setMoisConso(m)} className={cn('px-3 py-1.5 text-sm font-medium', moisConso === m ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                {m} mois
              </button>
            ))}
          </div>
        </div>
        {lco ? <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Chargement...</div> : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={consommations?.consommations || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="mois" tick={{ fontSize: 9 }} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip content={<TooltipFCFA />} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="Ciment" fill="#3B82F6" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Sable" fill="#10B981" stackId="a" />
              <Bar dataKey="Gasoil" fill="#F59E0B" stackId="a" />
              <Bar dataKey="Gravier 5/15" fill="#8B5CF6" stackId="a" />
              <Bar dataKey="Gravier 15/25" fill="#06B6D4" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {/* Prévision rupture stocks */}
        {consommations?.previsionRupture && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
            {consommations.previsionRupture.map((s) => (
              <div key={s.materiau} className={cn('rounded-xl p-3 border', s.risqueRupture === 'CRITIQUE' ? 'bg-red-50 border-red-200' : s.risqueRupture === 'AVERTISSEMENT' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200')}>
                <p className="text-xs font-semibold text-gray-600 truncate">{s.designation}</p>
                <p className="text-lg font-extrabold text-gray-800 mt-0.5">{s.moisRestants >= 99 ? '∞' : s.moisRestants} mois</p>
                <p className="text-xs text-gray-400">{s.consoMoyenneMois?.toLocaleString('fr-FR')} {s.unite}/mois</p>
                <span className={cn('text-xs font-bold', s.risqueRupture === 'CRITIQUE' ? 'text-red-600' : s.risqueRupture === 'AVERTISSEMENT' ? 'text-amber-600' : 'text-green-600')}>
                  {s.risqueRupture === 'OK' ? '✓ OK' : s.risqueRupture === 'AVERTISSEMENT' ? '⚠ Surveiller' : '🚨 Critique'}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Analyse paiements */}
      {paiements?.modesPaiement?.length > 0 && (
        <SectionCard title="Modes de paiement préférés" icon={TrendingUp} color="text-teal-600">
          <div className="flex gap-4 flex-wrap">
            {paiements.modesPaiement.map((m, i) => (
              <div key={m.mode} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                <span className="text-sm text-gray-600">{m.mode}</span>
                <span className="text-sm font-bold text-gray-800">{formatMontant(m.montant)}</span>
                <span className="text-xs text-gray-400">({m.count} fois)</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
};

export default Analytiques;
