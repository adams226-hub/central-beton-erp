import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, AlertTriangle, TrendingDown, TrendingUp, Plus, History, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { stocksAPI } from '../api';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatMontant, formatDateTime } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const STATUT_COLORS = {
  OK: { card: 'border-green-200 bg-green-50/50', badge: 'bg-green-100 text-green-800', bar: 'bg-green-500' },
  FAIBLE: { card: 'border-amber-300 bg-amber-50/50', badge: 'bg-amber-100 text-amber-800', bar: 'bg-amber-500' },
  CRITIQUE: { card: 'border-red-300 bg-red-50/50', badge: 'bg-red-100 text-red-800', bar: 'bg-red-500' },
};

const TYPE_MOUV_ICONS = {
  ENTREE_ACHAT: { icon: '⬆️', label: 'Achat', color: 'text-green-600' },
  ENTREE_RETOUR: { icon: '↩️', label: 'Retour', color: 'text-green-500' },
  SORTIE_PRODUCTION: { icon: '⬇️', label: 'Production', color: 'text-blue-600' },
  SORTIE_PERTE: { icon: '❌', label: 'Perte', color: 'text-red-500' },
  INVENTAIRE: { icon: '📋', label: 'Inventaire', color: 'text-gray-600' },
  AJUSTEMENT: { icon: '🔧', label: 'Ajustement', color: 'text-purple-600' },
};

const EntreeModal = ({ stock, onSuccess, onClose }) => {
  const [form, setForm] = useState({ quantite: '', prixUnitaire: stock.prixUnitaire, fournisseur: stock.fournisseur || '', reference: '', motif: 'Achat fournisseur' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.quantite || parseFloat(form.quantite) <= 0) return toast.error('Quantité invalide');
    setLoading(true);
    try {
      await stocksAPI.enregistrerEntree({ stockId: stock.id, ...form });
      toast.success(`+${form.quantite} ${stock.unite} ajoutés au stock ${stock.designation}`);
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-green-600" /> Entrée stock : {stock.designation}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { label: `Quantité (${stock.unite}) *`, key: 'quantite', type: 'number', step: '0.01' },
            { label: `Prix unitaire (FCFA/${stock.unite})`, key: 'prixUnitaire', type: 'number' },
            { label: 'Fournisseur', key: 'fournisseur' },
            { label: 'N° bon / référence', key: 'reference' },
            { label: 'Motif', key: 'motif' },
          ].map(({ label, key, ...rest }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="amp-input text-sm" {...rest} />
            </div>
          ))}
          {form.quantite && form.prixUnitaire && (
            <div className="bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
              Total : {formatMontant(parseFloat(form.quantite) * parseFloat(form.prixUnitaire))}
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-green-700 hover:bg-green-800 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-60">
              {loading ? 'Enregistrement...' : 'Confirmer l\'entrée'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium text-sm">Annuler</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const MouvementsModal = ({ stock, onClose }) => {
  const { data: mouvements, isLoading } = useQuery({
    queryKey: ['mouvements', stock.id],
    queryFn: () => stocksAPI.getMouvements(stock.id),
    select: (r) => r.data.data,
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800 flex items-center gap-2"><History size={18} className="text-blue-600" /> Historique : {stock.designation}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          {isLoading ? <PageLoader /> : (
            <div className="space-y-2">
              {mouvements?.map((m) => {
                const cfg = TYPE_MOUV_ICONS[m.type] || { icon: '•', label: m.type, color: 'text-gray-500' };
                const isEntree = m.type.startsWith('ENTREE');
                return (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="text-lg">{cfg.icon}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className={cn('text-sm font-medium', cfg.color)}>
                          {isEntree ? '+' : '-'}{m.quantite.toLocaleString('fr-FR')} {stock.unite}
                        </span>
                        <span className="text-xs text-gray-400">{formatDateTime(m.createdAt)}</span>
                      </div>
                      <p className="text-xs text-gray-500">{cfg.label} {m.motif ? `· ${m.motif}` : ''}</p>
                      <p className="text-xs text-gray-400">Stock : {m.quantiteAvant.toLocaleString('fr-FR')} → {m.quantiteApres.toLocaleString('fr-FR')} {stock.unite} · {m.user?.prenom} {m.user?.nom}</p>
                    </div>
                  </div>
                );
              })}
              {!isLoading && !mouvements?.length && <p className="text-center text-gray-400 py-8">Aucun mouvement</p>}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const Stocks = () => {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [entreeTarget, setEntreeTarget] = useState(null);
  const [histoTarget, setHistoTarget] = useState(null);

  const { data: stocks, isLoading, refetch } = useQuery({
    queryKey: ['stocks'],
    queryFn: () => stocksAPI.lister(),
    select: (r) => r.data.data,
    refetchInterval: 60000,
  });

  if (isLoading) return <PageLoader />;

  const alertes = stocks?.filter((s) => s.statut !== 'OK') || [];
  const valeurTotale = stocks?.reduce((a, s) => a + (s.valeurStock || 0), 0) || 0;

  const onSuccess = () => {
    setEntreeTarget(null);
    qc.invalidateQueries(['stocks']);
    qc.invalidateQueries(['mouvements']);
  };

  return (
    <div className="space-y-5">
      {/* Alertes */}
      {alertes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 text-sm">{alertes.filter(s => s.statut === 'CRITIQUE').length} stock(s) critique(s) · {alertes.filter(s => s.statut === 'FAIBLE').length} stock(s) faible(s)</p>
            <p className="text-red-600 text-xs">{alertes.map(s => s.designation).join(', ')}</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="amp-stat-card"><p className="text-sm text-gray-500">Matières</p><p className="text-2xl font-bold text-gray-800">{stocks?.length || 0}</p></div>
        <div className="amp-stat-card"><p className="text-sm text-gray-500">Valeur totale</p><p className="text-xl font-bold text-gray-800">{formatMontant(valeurTotale)}</p></div>
        <div className="amp-stat-card border border-amber-200"><p className="text-sm text-amber-600">Stocks faibles</p><p className="text-2xl font-bold text-amber-700">{alertes.filter(s => s.statut === 'FAIBLE').length}</p></div>
        <div className="amp-stat-card border border-red-200"><p className="text-sm text-red-600">Stocks critiques</p><p className="text-2xl font-bold text-red-700">{alertes.filter(s => s.statut === 'CRITIQUE').length}</p></div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">Niveaux de stock en temps réel</p>
        <button onClick={() => refetch()} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"><RefreshCw size={16} /></button>
      </div>

      {/* Grille stocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {stocks?.map((stock, i) => {
          const cfg = STATUT_COLORS[stock.statut] || STATUT_COLORS.OK;
          const pctAlerte = Math.min(100, (stock.quantite / (stock.seuilAlerte * 3)) * 100);

          return (
            <motion.div
              key={stock.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn('amp-card border p-5', cfg.card)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Package size={16} className="text-blue-600" />
                    <h3 className="font-semibold text-gray-800 text-sm">{stock.designation}</h3>
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block', cfg.badge)}>
                    {stock.statut === 'OK' ? '✓ Normal' : stock.statut === 'FAIBLE' ? '⚠ Faible' : '🚨 Critique'}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setHistoTarget(stock)} className="p-1.5 hover:bg-white/70 rounded-lg text-gray-500 transition-colors" title="Historique">
                    <History size={14} />
                  </button>
                  {hasPermission('stock:write') && (
                    <button onClick={() => setEntreeTarget(stock)} className="p-1.5 hover:bg-green-100 rounded-lg text-green-600 transition-colors" title="Entrée stock">
                      <Plus size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Quantité principale */}
              <div className="text-center my-3">
                <p className="text-3xl font-bold text-gray-800">{stock.quantite.toLocaleString('fr-FR')}</p>
                <p className="text-sm text-gray-500">{stock.unite}</p>
              </div>

              {/* Barre de niveau */}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Seuil critique : {stock.seuilCritique.toLocaleString('fr-FR')}</span>
                  <span>Alerte : {stock.seuilAlerte.toLocaleString('fr-FR')}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div className={cn('h-2.5 rounded-full transition-all', cfg.bar)} style={{ width: `${Math.min(100, pctAlerte)}%` }} />
                </div>
              </div>

              {/* Infos */}
              <div className="flex justify-between text-xs text-gray-500">
                <span>{formatMontant(stock.valeurStock)}</span>
                <span>{formatMontant(stock.prixUnitaire)}/{stock.unite}</span>
              </div>
              {stock.fournisseur && <p className="text-xs text-gray-400 mt-1">Fournisseur : {stock.fournisseur}</p>}
            </motion.div>
          );
        })}
      </div>

      {entreeTarget && <EntreeModal stock={entreeTarget} onSuccess={onSuccess} onClose={() => setEntreeTarget(null)} />}
      {histoTarget && <MouvementsModal stock={histoTarget} onClose={() => setHistoTarget(null)} />}
    </div>
  );
};

export default Stocks;
