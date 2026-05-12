import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ClipboardList, CheckCircle, XCircle, Clock, TrendingUp, Package,
  Truck, BarChart3, AlertTriangle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { commandesAPI } from '../api';
import StatCard from '../components/common/StatCard';
import StatusBadge from '../components/common/StatusBadge';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatMontant, formatDate, formatVolume } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['statistiques'],
    queryFn: () => commandesAPI.statistiques(),
    select: (res) => res.data.data,
    refetchInterval: 30000,
  });

  const { data: commandesData, isLoading: cmdLoading } = useQuery({
    queryKey: ['commandes', 'recent'],
    queryFn: () => commandesAPI.lister({ limit: 8 }),
    select: (res) => res.data.data.commandes,
  });

  if (statsLoading || cmdLoading) return <PageLoader />;

  const stats = statsData || {};

  const pieData = [
    { name: 'En attente', value: stats.enAttente || 0, color: '#f59e0b' },
    { name: 'Validées', value: stats.validees || 0, color: '#10b981' },
    { name: 'En production', value: stats.enProduction || 0, color: '#3b82f6' },
    { name: 'Livrées', value: stats.livrees || 0, color: '#06b6d4' },
    { name: 'Rejetées', value: stats.rejetees || 0, color: '#ef4444' },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Titre + Bienvenue */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Bonjour, {user?.prenom} 👋
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Voici l'état de votre centrale à béton en temps réel
          </p>
        </div>
        <button
          onClick={() => navigate('/commandes/nouvelle')}
          className="hidden md:flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <ClipboardList size={16} /> Nouvelle commande
        </button>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total commandes" value={stats.total || 0} icon={ClipboardList} color="blue" subtitle={`${stats.commandesMois || 0} ce mois`} delay={0} />
        <StatCard title="En attente" value={stats.enAttente || 0} icon={Clock} color="orange" subtitle="À valider" delay={0.05} />
        <StatCard title="Validées" value={stats.validees || 0} icon={CheckCircle} color="green" delay={0.1} />
        <StatCard title="Rejetées" value={stats.rejetees || 0} icon={XCircle} color="red" delay={0.15} />
      </div>

      {/* KPIs financiers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Chiffre d'affaires"
          value={formatMontant(stats.chiffreAffaires)}
          icon={TrendingUp}
          color="green"
          subtitle="Commandes validées/livrées"
          delay={0.2}
        />
        <StatCard
          title="Coût de production"
          value={formatMontant(stats.coutTotal)}
          icon={Package}
          color="blue"
          delay={0.25}
        />
        <StatCard
          title="Marge bénéficiaire"
          value={formatMontant(stats.margeTotale)}
          icon={BarChart3}
          color={stats.margeTotale > 0 ? 'teal' : 'red'}
          subtitle={stats.chiffreAffaires > 0 ? `${Math.round((stats.margeTotale / stats.chiffreAffaires) * 100)}% taux de marge` : ''}
          delay={0.3}
        />
      </div>

      {/* Graphiques + Dernières commandes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Répartition statuts */}
        {pieData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="amp-card p-5"
          >
            <h3 className="font-semibold text-gray-800 mb-4">Répartition des commandes</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${v} commande(s)`, n]} />
                <Legend iconSize={8} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* Dernières commandes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={`amp-card overflow-hidden ${pieData.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}`}
        >
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Dernières commandes</h3>
            <button onClick={() => navigate('/commandes')} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
              Voir tout →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Référence</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Volume</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {commandesData?.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-gray-400">Aucune commande</td></tr>
                )}
                {commandesData?.map((cmd) => (
                  <tr
                    key={cmd.id}
                    onClick={() => navigate(`/commandes/${cmd.id}`)}
                    className="table-row-hover"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-blue-700 font-medium">{cmd.reference}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{cmd.nomClient}</p>
                      <p className="text-xs text-gray-400 hidden sm:block truncate max-w-[140px]">{cmd.adresseChantier}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{formatVolume(cmd.volumeBeton)}</td>
                    <td className="px-4 py-3"><StatusBadge statut={cmd.statut} /></td>
                    <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">{formatDate(cmd.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>

      {/* Alertes / En attente de validation */}
      {stats.enAttente > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4"
        >
          <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-medium text-amber-800 text-sm">
              {stats.enAttente} commande{stats.enAttente > 1 ? 's' : ''} en attente de validation
            </p>
            <p className="text-amber-600 text-xs mt-0.5">Cliquez sur "Gestion des commandes" pour traiter</p>
          </div>
          <button
            onClick={() => navigate('/commandes')}
            className="ml-auto bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >
            Voir →
          </button>
        </motion.div>
      )}
    </div>
  );
};

export default Dashboard;
