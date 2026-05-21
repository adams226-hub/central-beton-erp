import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Square, ChevronRight, Factory, Clock, CheckCircle2,
  Truck, PackageCheck, AlertCircle, Plus, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { productionAPI, commandesAPI } from '../api';
import { PageLoader } from '../components/common/LoadingSpinner';
import StatusBadge from '../components/common/StatusBadge';
import { formatMontant, formatDate, formatDateTime, formatVolume } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const STATUT_PROD = {
  EN_ATTENTE: { label: 'En attente', color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400', icon: Clock },
  EN_COURS: { label: 'En cours', color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500 animate-pulse', icon: Factory },
  CHARGEMENT: { label: 'Chargement', color: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500', icon: PackageCheck },
  LIVRAISON: { label: 'En livraison', color: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500', icon: Truck },
  TERMINE: { label: 'Terminé', color: 'bg-green-100 text-green-800', dot: 'bg-green-500', icon: CheckCircle2 },
  ANNULE: { label: 'Annulé', color: 'bg-red-100 text-red-700', dot: 'bg-red-400', icon: AlertCircle },
};

const StatutBadgeProd = ({ statut }) => {
  const cfg = STATUT_PROD[statut] || STATUT_PROD.EN_ATTENTE;
  const Icon = cfg.icon;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium', cfg.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
};

const DemarrerProductionModal = ({ onSuccess, onClose }) => {
  const [commandeId, setCommandeId] = useState('');
  const [observations, setObs] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: commandes, isLoading: cmdLoading } = useQuery({
    queryKey: ['commandes-validees'],
    queryFn: () => commandesAPI.lister({ limit: 200 }),
    select: (r) => (r.data?.data?.commandes ?? []).filter((c) => ['VALIDEE', 'EN_PRODUCTION'].includes(c.statut)),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!commandeId) return toast.error('Sélectionner une commande');
    setLoading(true);
    try {
      await productionAPI.demarrer({ commandeId, observations });
      toast.success('Production démarrée ! Les stocks ont été automatiquement déduits.');
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Erreur lors du démarrage de la production';
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Play size={18} className="text-blue-600" /> Démarrer une production
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commande validée *</label>
            <select value={commandeId} onChange={(e) => setCommandeId(e.target.value)} className="amp-input">
              <option value="">— Sélectionner une commande —</option>
              {cmdLoading && <option disabled>Chargement...</option>}
              {!cmdLoading && commandes?.length === 0 && <option disabled>Aucune commande validée</option>}
              {commandes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.reference} — {c.nomClient} — {c.volumeBeton} m³ {c.typeBeton}
                </option>
              ))}
            </select>
            {!cmdLoading && commandes?.length === 0 && (
              <p className="text-amber-600 text-xs mt-1">Aucune commande VALIDÉE ou EN_PRODUCTION disponible</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
            <textarea value={observations} onChange={(e) => setObs(e.target.value)} rows={2} className="amp-input resize-none" placeholder="Remarques opérateur..." />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
            ⚠️ Le démarrage déduira automatiquement toutes les matières premières du stock selon la formulation.
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-lg font-medium disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Démarrage...</> : <><Play size={15} /> Démarrer la production</>}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium">Annuler</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const TerminerModal = ({ production, onSuccess, onClose }) => {
  const [form, setForm] = useState({ volumeProduit: production.volumePlanifie, gasoilConsomme: '', maintenanceCout: 0, observations: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await productionAPI.terminer(production.id, form);
      toast.success('Production terminée ! Bénéfice net calculé automatiquement.');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Square size={18} className="text-green-600" /> Clôturer la production {production.reference}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Volume réellement produit (m³)', key: 'volumeProduit', type: 'number', step: '0.5' },
            { label: 'Gasoil consommé (litres)', key: 'gasoilConsomme', type: 'number' },
            { label: 'Coût maintenance imprévue (FCFA)', key: 'maintenanceCout', type: 'number' },
          ].map(({ label, key, ...rest }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="amp-input" {...rest} />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Observations</label>
            <textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} rows={2} className="amp-input resize-none" />
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700">
            ✅ Le bénéfice net réel sera calculé automatiquement et mis à jour sur la commande.
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="flex-1 bg-green-700 hover:bg-green-800 text-white py-2.5 rounded-lg font-medium disabled:opacity-60">
              {loading ? 'Clôture en cours...' : 'Clôturer la production'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium">Annuler</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const Production = () => {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [showDemarrer, setShowDemarrer] = useState(false);
  const [terminerTarget, setTerminerTarget] = useState(null);
  const [statutFilter, setStatutFilter] = useState('');

  const { data: productions, isLoading, refetch } = useQuery({
    queryKey: ['productions', statutFilter],
    queryFn: () => productionAPI.lister({ statut: statutFilter }),
    select: (r) => r.data.data,
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ['production-stats'],
    queryFn: () => productionAPI.statistiques(),
    select: (r) => r.data.data,
    refetchInterval: 30000,
  });

  const changerStatut = async (id, statut) => {
    try {
      await productionAPI.changerStatut(id, { statut });
      toast.success(`Statut mis à jour : ${STATUT_PROD[statut]?.label}`);
      qc.invalidateQueries({ queryKey: ['productions'] });
      qc.invalidateQueries({ queryKey: ['production-stats'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  if (isLoading) return <PageLoader />;

  const onSuccess = () => {
    setShowDemarrer(false);
    setTerminerTarget(null);
    qc.invalidateQueries({ queryKey: ['productions'] });
    qc.invalidateQueries({ queryKey: ['production-stats'] });
    qc.invalidateQueries({ queryKey: ['statistiques'] });
    qc.invalidateQueries({ queryKey: ['stocks'] });
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'En cours', value: stats.enCours, color: 'bg-blue-500', icon: Factory },
            { label: 'Ce mois', value: stats.total, color: 'bg-gray-600', icon: CheckCircle2 },
            { label: 'Volume produit', value: `${(stats.volumeTotal || 0).toLocaleString('fr-FR')} m³`, color: 'bg-green-600', icon: PackageCheck },
            { label: 'Coût total', value: formatMontant(stats.coutTotal), color: 'bg-purple-600', icon: AlertCircle },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="amp-stat-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{label}</p>
                  <p className="text-xl font-bold text-gray-800 mt-1">{value}</p>
                </div>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color)}>
                  <Icon size={18} className="text-white" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} className="amp-input w-auto min-w-[180px] text-sm">
          <option value="">Tous les statuts</option>
          {Object.entries(STATUT_PROD).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={() => refetch()} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"><RefreshCw size={16} /></button>
        {hasPermission('production:write') && (
          <button onClick={() => setShowDemarrer(true)} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium ml-auto">
            <Play size={15} /> Démarrer une production
          </button>
        )}
      </div>

      {/* Liste productions */}
      <div className="space-y-3">
        {productions?.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Factory size={40} className="mx-auto mb-3 opacity-30" />
            <p>Aucune production. Démarrez depuis une commande validée.</p>
          </div>
        )}
        {productions?.map((prod, i) => (
          <motion.div
            key={prod.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="amp-card p-5"
          >
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Factory size={18} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-800 font-mono text-sm">{prod.reference}</span>
                    <StatutBadgeProd statut={prod.statut} />
                  </div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {prod.commande?.nomClient} · {formatVolume(prod.volumePlanifie)} {prod.commande?.typeBeton}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Opérateur : {prod.operateur?.prenom} {prod.operateur?.nom} · {formatDateTime(prod.dateDebut || prod.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Actions selon statut */}
                {prod.statut === 'EN_COURS' && hasPermission('production:write') && (
                  <>
                    <button onClick={() => changerStatut(prod.id, 'CHARGEMENT')} className="text-xs bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                      <PackageCheck size={13} /> Chargement
                    </button>
                    <button onClick={() => setTerminerTarget(prod)} className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                      <Square size={13} /> Terminer
                    </button>
                  </>
                )}
                {prod.statut === 'CHARGEMENT' && hasPermission('production:write') && (
                  <button onClick={() => changerStatut(prod.id, 'LIVRAISON')} className="text-xs bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                    <Truck size={13} /> Livraison
                  </button>
                )}
                {prod.statut === 'LIVRAISON' && hasPermission('production:write') && (
                  <button onClick={() => setTerminerTarget(prod)} className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1">
                    <CheckCircle2 size={13} /> Clôturer
                  </button>
                )}
              </div>
            </div>

            {/* Barre de progression */}
            {prod.statut !== 'TERMINE' && prod.statut !== 'ANNULE' && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Volume produit : {prod.volumeProduit || 0} / {prod.volumePlanifie} m³</span>
                  <span>{Math.round(((prod.volumeProduit || 0) / prod.volumePlanifie) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, ((prod.volumeProduit || 0) / prod.volumePlanifie) * 100)}%` }} />
                </div>
              </div>
            )}

            {/* Infos si terminé */}
            {prod.statut === 'TERMINE' && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: 'Volume réel', value: `${prod.volumeProduit} m³` },
                  { label: 'Durée', value: prod.dureeHeures ? `${prod.dureeHeures.toFixed(1)} h` : '-' },
                  { label: 'Coût total', value: formatMontant(prod.coutTotal) },
                  { label: 'Rendement', value: prod.rendement ? `${prod.rendement.toFixed(1)}%` : '-' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
                    <p className="text-[10px] text-gray-400 uppercase">{label}</p>
                    <p className="text-sm font-bold text-gray-700">{value}</p>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {showDemarrer && <DemarrerProductionModal onSuccess={onSuccess} onClose={() => setShowDemarrer(false)} />}
      {terminerTarget && <TerminerModal production={terminerTarget} onSuccess={onSuccess} onClose={() => setTerminerTarget(null)} />}
    </div>
  );
};

export default Production;
