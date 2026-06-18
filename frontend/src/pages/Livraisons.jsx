import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Truck, Plus, MapPin, Clock, CheckCircle, XCircle, FileDown, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { livraisonsAPI, commandesAPI, equipementsAPI } from '../api';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatDate, formatDateTime } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const STATUT_CFG = {
  PLANIFIEE: { color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500', label: 'Planifiée' },
  LIVREE: { color: 'bg-green-100 text-green-800', dot: 'bg-green-500', label: 'Livrée' },
  ANNULEE: { color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', label: 'Annulée' },
};

const PlanifierModal = ({ onSuccess, onClose }) => {
  const [form, setForm] = useState({ commandeId: '', toupieId: '', chauffeur: '', heureDepart: '', adresseChantier: '', observations: '' });
  const [loading, setLoading] = useState(false);

  const { data: commandes, isLoading: cmdLoading } = useQuery({
    queryKey: ['commandes-livraison'],
    queryFn: () => commandesAPI.lister({ limit: 200 }),
    select: (r) => r.data?.data?.commandes?.filter((c) => ['EN_PRODUCTION', 'VALIDEE', 'PRODUCTION_TERMINEE'].includes(c.statut)) ?? [],
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: toupies } = useQuery({
    queryKey: ['equipements-toupies'],
    queryFn: () => equipementsAPI.lister({ type: 'TOUPIE' }),
    select: (r) => r.data?.data?.filter((e) => ['DISPONIBLE', 'EN_SERVICE'].includes(e.statut)) ?? [],
    staleTime: 0,
  });

  const handleCommandeChange = (e) => {
    const id = e.target.value;
    const cmd = commandes?.find((c) => c.id === id);
    setForm({ ...form, commandeId: id, adresseChantier: cmd?.adresseChantier || '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.commandeId) return toast.error('Commande requise');
    setLoading(true);
    try {
      await livraisonsAPI.planifier(form);
      toast.success('Livraison planifiée');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Truck size={18} className="text-blue-600" /> Planifier une livraison</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Commande *</label>
            <select value={form.commandeId} onChange={handleCommandeChange} className="w-full amp-input text-sm" required>
              <option value="">— Sélectionner une commande —</option>
              {cmdLoading && <option disabled>Chargement...</option>}
              {!cmdLoading && commandes?.length === 0 && <option disabled>Aucune commande en production</option>}
              {commandes?.map((c) => (
                <option key={c.id} value={c.id}>{c.reference} — {c.nomClient} — {c.volumeBeton} m³</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Toupie</label>
              <select value={form.toupieId} onChange={(e) => setForm({ ...form, toupieId: e.target.value })} className="w-full amp-input text-sm">
                <option value="">— Choisir une toupie —</option>
                {toupies?.map((t) => <option key={t.id} value={t.id}>{t.nom} ({t.statut})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chauffeur</label>
              <input value={form.chauffeur} onChange={(e) => setForm({ ...form, chauffeur: e.target.value })} className="amp-input text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date et heure prévue</label>
            <input type="datetime-local" value={form.heureDepart} onChange={(e) => setForm({ ...form, heureDepart: e.target.value })} className="amp-input text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Adresse de livraison</label>
            <input value={form.adresseChantier} onChange={(e) => setForm({ ...form, adresseChantier: e.target.value })} className="amp-input text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observations</label>
            <textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} rows={2} className="amp-input text-sm resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-60">
              {loading ? 'Planification...' : 'Planifier'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium text-sm">Annuler</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const LivrerModal = ({ livraison, onSuccess, onClose }) => {
  const [form, setForm] = useState({ volumeReel: livraison.volumePlanifie || '', observations: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await livraisonsAPI.livrer(livraison.id, form);
      toast.success('Livraison confirmée');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><CheckCircle size={18} className="text-green-600" /> Confirmer la livraison</h2>
        <p className="text-sm text-gray-500 mb-4">{livraison.commande?.reference} — {livraison.commande?.nomClient}</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Volume livré (m³) *</label>
            <input type="number" step="0.1" value={form.volumeReel} onChange={(e) => setForm({ ...form, volumeReel: e.target.value })} className="amp-input text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observations</label>
            <textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} rows={3} className="amp-input text-sm resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-green-700 hover:bg-green-800 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-60">
              {loading ? 'Confirmation...' : '✓ Confirmer livraison'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium text-sm">Annuler</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const LivraisonCard = ({ liv, onLivrer, onAnnuler, onExport, canEdit }) => {
  const cfg = STATUT_CFG[liv.statut] || STATUT_CFG.PLANIFIEE;
  const canConfirm = liv.statut === 'PLANIFIEE';
  const canCancel = liv.statut === 'PLANIFIEE';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="amp-card p-5"
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-100">
            <Truck size={20} className="text-gray-500" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-blue-700">{liv.reference}</span>
              <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />{cfg.label}
              </span>
            </div>
            <p className="font-bold text-gray-800 mt-0.5">{liv.commande?.nomClient}</p>
            <p className="text-xs text-gray-500">{liv.commande?.reference} · {liv.volumePlanifie} m³</p>
            {liv.adresseChantier && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><MapPin size={10} />{liv.adresseChantier}</p>
            )}
          </div>
        </div>
        <div className="text-right space-y-1">
          {liv.heureDepart && <p className="text-xs text-gray-400 flex items-center gap-1 justify-end"><Clock size={10} /> Prévu : {formatDateTime(liv.heureDepart)}</p>}
          {liv.chauffeur && <p className="text-xs text-gray-500">Chauffeur : <span className="font-medium">{liv.chauffeur}</span></p>}
          {liv.toupie && <p className="text-xs text-gray-500">Toupie : <span className="font-medium">{liv.toupie.nom}</span></p>}
          {liv.heureArrivee && <p className="text-xs text-green-600 font-medium">Livré : {formatDateTime(liv.heureArrivee)}</p>}
          {liv.volumeReel && <p className="text-xs font-bold text-gray-700">Volume livré : {liv.volumeReel} m³</p>}
          {/* Bouton état de livraison */}
          <button
            onClick={() => onExport(liv.commandeId)}
            className="inline-flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium mt-1"
            title="Télécharger état de livraison"
          >
            <FileDown size={11} /> État livraison
          </button>
        </div>
      </div>

      {canEdit && (canConfirm || canCancel) && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          {canConfirm && (
            <button onClick={() => onLivrer(liv)} className="flex items-center gap-1.5 text-xs bg-green-100 hover:bg-green-200 text-green-700 px-3 py-1.5 rounded-lg font-medium">
              <CheckCircle size={12} /> Confirmer livraison
            </button>
          )}
          {canCancel && (
            <button onClick={() => onAnnuler(liv.id)} className="ml-auto flex items-center gap-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-lg font-medium">
              <XCircle size={12} /> Annuler
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};

const Livraisons = () => {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [livrerTarget, setLivrerTarget] = useState(null);
  const [filtre, setFiltre] = useState('');
  const [search, setSearch] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const resetFiltres = () => { setSearch(''); setDateDebut(''); setDateFin(''); };
  const hasFiltres = search || dateDebut || dateFin;

  const { data: livraisons, isLoading } = useQuery({
    queryKey: ['livraisons', filtre, search, dateDebut, dateFin],
    queryFn: () => livraisonsAPI.lister({
      statut: filtre || undefined,
      search: search || undefined,
      dateDebut: dateDebut || undefined,
      dateFin: dateFin || undefined,
    }),
    select: (r) => r.data.data?.livraisons ?? r.data.data ?? [],
    refetchInterval: 30000,
  });

  // Unfiltered data for KPIs and enRoute alert (always reflects real totals)
  const { data: livraisonsAll } = useQuery({
    queryKey: ['livraisons', 'all'],
    queryFn: () => livraisonsAPI.lister({ limit: 1000 }),
    select: (r) => r.data.data?.livraisons ?? r.data.data ?? [],
    refetchInterval: 30000,
  });

  const canEdit = hasPermission('livraison:write');

  const annuler = async (id) => {
    if (!window.confirm('Annuler cette livraison ?')) return;
    try {
      await livraisonsAPI.annuler(id);
      toast.success('Livraison annulée');
      qc.invalidateQueries({ queryKey: ['livraisons'] });
    } catch (err) { toast.error('Erreur'); }
  };

  const exportEtat = async (commandeId) => {
    if (!commandeId) return toast.error('Commande introuvable');
    const toastId = toast.loading('Génération état de livraison...');
    try {
      const res = await livraisonsAPI.exportEtatLivraison(commandeId);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `etat-livraison-${commandeId}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('État de livraison téléchargé', { id: toastId });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur export', { id: toastId });
    }
  };

  const onSuccess = () => {
    setShowForm(false);
    setLivrerTarget(null);
    qc.invalidateQueries({ queryKey: ['livraisons'] });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      {/* KPIs — always based on full unfiltered data */}
      {livraisonsAll && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Planifiées', value: livraisonsAll.filter((l) => l.statut === 'PLANIFIEE').length, color: 'text-blue-700' },
            { label: 'Livrées', value: livraisonsAll.filter((l) => l.statut === 'LIVREE').length, color: 'text-green-700' },
            { label: 'Volume livré (m³)', value: livraisonsAll.filter((l) => l.volumeReel).reduce((a, l) => a + (l.volumeReel || 0), 0).toFixed(1), color: 'text-gray-800' },
          ].map(({ label, value, color }) => (
            <div key={label} className="amp-stat-card">
              <p className="text-sm text-gray-500">{label}</p>
              <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="amp-card p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
            {[['', 'Toutes'], ['PLANIFIEE', 'Planifiées'], ['LIVREE', 'Livrées'], ['ANNULEE', 'Annulées']].map(([v, l]) => (
              <button key={v} onClick={() => setFiltre(v)} className={cn('px-3 py-1.5 text-sm font-medium', filtre === v ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
                {l}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              className="amp-input pl-8 text-sm" />
          </div>
          <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className="amp-input w-auto text-sm" title="Date début" />
          <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className="amp-input w-auto text-sm" title="Date fin" />
          {hasFiltres && (
            <button onClick={resetFiltres} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
              <X size={13} /> Réinitialiser
            </button>
          )}
          {canEdit && (
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium ml-auto">
              <Plus size={15} /> Planifier livraison
            </button>
          )}
        </div>
        {hasFiltres && <p className="text-xs text-blue-600 font-medium">{livraisons?.length || 0} résultat(s) avec les filtres actifs</p>}
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {livraisons?.length === 0 && (
          <div className="amp-card p-12 text-center text-gray-400">
            <Truck size={32} className="mx-auto mb-3 opacity-30" />
            <p>Aucune livraison{filtre ? ` avec ce statut` : ''}</p>
          </div>
        )}
        {livraisons?.map((liv) => (
          <LivraisonCard
            key={liv.id}
            liv={liv}
            onLivrer={setLivrerTarget}
            onAnnuler={annuler}
            onExport={exportEtat}
            canEdit={canEdit}
          />
        ))}
      </div>

      {showForm && <PlanifierModal onSuccess={onSuccess} onClose={() => setShowForm(false)} />}
      {livrerTarget && <LivrerModal livraison={livrerTarget} onSuccess={onSuccess} onClose={() => setLivrerTarget(null)} />}
    </div>
  );
};

export default Livraisons;
