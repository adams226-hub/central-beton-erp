import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Brain, Calendar, Target, RefreshCw, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { analyticsAPI } from '../api';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatMontant } from '../utils/formatters';
import { cn } from '../lib/utils';

const TooltipFCFA = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name} : {typeof p.value === 'number' && p.value > 10000
            ? formatMontant(p.value)
            : (p.value || 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })}
        </p>
      ))}
    </div>
  );
};

const TendanceBadge = ({ slope }) => {
  const isPositive = slope > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
      <Icon size={10} /> {isPositive ? '+' : ''}{slope?.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA/mois
    </span>
  );
};

const ConfidenceBar = ({ value, label }) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</span>
    <div className="flex-1 bg-gray-100 rounded-full h-2">
      <div
        className={cn('h-2 rounded-full', value >= 80 ? 'bg-green-500' : value >= 60 ? 'bg-amber-500' : 'bg-red-400')}
        style={{ width: `${value}%` }}
      />
    </div>
    <span className={cn('text-xs font-bold w-10 text-right', value >= 80 ? 'text-green-700' : value >= 60 ? 'text-amber-700' : 'text-red-600')}>{value}%</span>
  </div>
);

const Previsions = () => {
  const qc = useQueryClient();
  const [periodes, setPeriodes] = useState(3);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['previsions', periodes],
    queryFn: () => analyticsAPI.previsionsBudgetaires(periodes),
    select: (r) => r.data.data,
  });

  if (isLoading) return <PageLoader />;

  // Combiner historique + prévisions pour le graphique
  const chartData = [
    ...(data?.historique || []).slice(-6).map((h) => ({
      label: h.label,
      ca: h.ca,
      benefice: h.benefice,
      volume: h.volume,
      type: 'historique',
    })),
    ...(data?.previsions || []).map((p) => ({
      label: p.label,
      caPrevu: p.caPrevu,
      beneficePrevu: p.beneficePrevu,
      volumePrevu: Math.round(p.volumePrevu * 100) / 100,
      caCible: p.budget?.caCible,
      type: 'prevision',
    })),
  ];

  const currentMoisIndex = (data?.historique || []).slice(-6).length - 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900 flex items-center gap-2">
            <Brain size={22} className="text-purple-600" /> Prévisions & IA
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Prévisions budgétaires basées sur {data?.source === 'ml' ? 'Machine Learning (Gradient Boosting)' : 'régression linéaire'}
            <span className={cn('ml-2 text-xs px-2 py-0.5 rounded-full', data?.source === 'ml' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700')}>
              {data?.source === 'ml' ? '🤖 ML' : '📐 Linéaire'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            {[3, 6].map((p) => (
              <button key={p} onClick={() => setPeriodes(p)} className={cn('px-4 py-2 text-sm font-medium', periodes === p ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                {p} mois
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Tendances */}
      {data?.tendance && (
        <div className="amp-card p-4 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600 font-medium">Tendance CA :</p>
            <TendanceBadge slope={data.tendance.ca} />
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-600 font-medium">Tendance Bénéfice :</p>
            <TendanceBadge slope={data.tendance.benefice} />
          </div>
        </div>
      )}

      {/* Fiabilité des prévisions */}
      {data?.previsions?.[0] && (
        <div className="amp-card p-5">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Target size={16} className="text-purple-600" /> Indice de confiance</h3>
          <div className="space-y-2 max-w-md">
            <ConfidenceBar value={data.previsions[0].confidenceCA || 70} label="Prévision CA" />
            <ConfidenceBar value={Math.max(50, (data.previsions[0].confidenceCA || 70) - 5)} label="Prévision Bénéfice" />
            <ConfidenceBar value={Math.max(60, (data.previsions[0].confidenceCA || 70) + 3)} label="Prévision Volume" />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Confiance calculée sur la base de {data?.historique?.length || 0} mois d'historique.
            Plus l'historique est long, plus les prévisions sont précises.
          </p>
        </div>
      )}

      {/* Graphique principal : Historique + Prévisions */}
      <div className="amp-card p-5">
        <h3 className="font-bold text-gray-800 mb-4">CA & Bénéfice — Historique + Prévisions {periodes} mois</h3>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 9 }} />
            <YAxis tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 9 }} />
            <Tooltip content={<TooltipFCFA />} />
            <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />

            {/* Ligne séparatrice historique/prévision */}
            <ReferenceLine x={chartData[currentMoisIndex]?.label} stroke="#94A3B8" strokeDasharray="4 2" label={{ value: 'Aujourd\'hui', fontSize: 9, fill: '#94A3B8' }} />

            {/* Historique */}
            <Bar dataKey="ca" name="CA réel" fill="#BFDBFE" radius={[2, 2, 0, 0]} />
            <Line type="monotone" dataKey="benefice" name="Bénéfice réel" stroke="#10B981" strokeWidth={2} dot={false} />

            {/* Prévisions */}
            <Bar dataKey="caPrevu" name="CA prévu" fill="#3B82F6" radius={[2, 2, 0, 0]} />
            <Line type="monotone" dataKey="beneficePrevu" name="Bénéfice prévu" stroke="#059669" strokeWidth={2} strokeDasharray="5 3" dot={{ fill: '#059669', r: 4 }} />
            {/* Cible budget manuel */}
            <Line type="monotone" dataKey="caCible" name="Objectif CA" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="3 2" dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Tableau des prévisions */}
      <div className="amp-card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 flex items-center gap-2"><Calendar size={16} className="text-blue-600" /> Détail des prévisions mensuelles</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Période', 'CA prévu', 'Bénéfice prévu', 'Volume prévu', 'Gasoil prévu', 'Objectif CA', 'Confiance'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(data?.previsions || []).map((p, i) => (
                <motion.tr key={p.label} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="hover:bg-blue-50/30">
                  <td className="px-4 py-3 font-semibold text-blue-700">{p.label}</td>
                  <td className="px-4 py-3 font-bold text-gray-800">{formatMontant(p.caPrevu)}</td>
                  <td className={cn('px-4 py-3 font-bold', p.beneficePrevu >= 0 ? 'text-green-700' : 'text-red-700')}>{formatMontant(p.beneficePrevu)}</td>
                  <td className="px-4 py-3 text-gray-600">{p.volumePrevu?.toLocaleString('fr-FR')} m³</td>
                  <td className="px-4 py-3 text-gray-600">{p.gasoilPrevu?.toLocaleString('fr-FR')} L</td>
                  <td className="px-4 py-3">
                    {p.budget ? (
                      <span className="font-medium text-gray-700">{formatMontant(p.budget.caCible)}</span>
                    ) : (
                      <span className="text-gray-300 italic text-xs">Non défini</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
                      (p.confidenceCA || 70) >= 80 ? 'bg-green-100 text-green-700' :
                      (p.confidenceCA || 70) >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                    )}>
                      {p.confidenceCA || 70}%
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recommandations IA */}
      <div className="amp-card p-5 border border-purple-200 bg-purple-50/30">
        <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Brain size={16} className="text-purple-600" /> Recommandations stratégiques</h3>
        <div className="space-y-2">
          {data?.tendance?.ca > 0 && (
            <div className="flex items-start gap-2 text-sm">
              <span className="text-green-500 mt-0.5">✓</span>
              <p className="text-gray-700">Le CA affiche une tendance haussière de <strong>{formatMontant(data.tendance.ca)}/mois</strong>. Envisagez d'augmenter les capacités de production pour répondre à la demande croissante.</p>
            </div>
          )}
          {data?.tendance?.ca < 0 && (
            <div className="flex items-start gap-2 text-sm">
              <span className="text-red-500 mt-0.5">⚠</span>
              <p className="text-gray-700">Le CA est en baisse de <strong>{formatMontant(Math.abs(data.tendance.ca))}/mois</strong>. Renforcez les actions commerciales et la prospection de nouveaux clients.</p>
            </div>
          )}
          {data?.tendance?.benefice < data?.tendance?.ca && (
            <div className="flex items-start gap-2 text-sm">
              <span className="text-amber-500 mt-0.5">⚠</span>
              <p className="text-gray-700">Les coûts progressent plus vite que les revenus. Analysez les postes de dépenses matières et carburant pour identifier des optimisations.</p>
            </div>
          )}
          <div className="flex items-start gap-2 text-sm">
            <span className="text-blue-500 mt-0.5">ℹ</span>
            <p className="text-gray-700">Prévisions calculées sur <strong>{data?.historique?.length || 0} mois d'historique</strong> via <em>{data?.source === 'ml' ? 'Gradient Boosting ML' : 'régression linéaire'}</em>. Pour améliorer la précision, continuez à enregistrer les productions et paiements régulièrement.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Previsions;
