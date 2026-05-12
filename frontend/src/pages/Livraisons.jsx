import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Truck, Plus, MapPin, Clock, CheckCircle, XCircle, AlertTriangle, Navigation } from 'lucide-react';
import toast from 'react-hot-toast';
import { livraisonsAPI, commandesAPI, equipementsAPI } from '../api';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatDate, formatDateTime } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const STATUT_CFG = {
  PLANIFIEE: { color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500', label: 'Planifiée' },
  EN_ROUTE: { color: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500 animate-pulse', label: 'En route' },
  LIVREE: { color: 'bg-green-100 text-green-800', dot: 'bg-green-500', label: 'Livrée' },
  RETARD: { color: 'bg-red-100 text-red-800', dot: 'bg-red-500', label: 'En retard' },
  ANNULEE: { color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400', label: 'Annulée' },
};

const PlanifierModal = ({ onSuccess, onClose }) => {
  const [form, setForm] = useState({ commandeId: '', equipementId: '', chauffeur: '', datePlanifiee: '', adresseLivraison: '', notes: '' });
  const [loading, setLoading] = useState(false);

  const { data: commandes } = useQuery({
    queryKey: ['commandes-livraison'],
    queryFn: () => commandesAPI.lister({ limit: 100 }),
    select: (r) => r.data.data.commandes.filter((c) => ['EN_PRODUCTION', 'VALIDEE'].includes(c.statut)),
  });

  const { data: toupies } = useQuery({
    queryKey: ['equipements-toupies'],
    queryFn: () => equipementsAPI.lister({ type: 'TOUPIE' }),
    select: (r) => r.data.data.filter((e) => e.statut === 'DISPONIBLE' || e.statut === 'EN_SERVICE'),
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.commandeId || !form.datePlanifiee) return toast.error('Commande et date requis');
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
            <select value={form.commandeId} onChange={(e) => setForm({ ...form, commandeId: e.target.value })} className="amp-input text-sm" required>
              <option value="">Sélectionner une commande...</option>
              {commandes?.map((c) => (
                <option key={c.id} value={c.id}>{c.reference} — {c.nomClient} — {c.volumeCommande} m³</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Toupie</label>
              <select value={form.equipementId} onChange={(e) => setForm({ ...form, equipementId: e.target.value })} className="amp-input text-sm">
                <option value="">Choisir une toupie...</option>
                {toupies?.map((t) => <option key={t.id} value={t.id}>{t.nom} ({t.statut})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chauffeur</label>
              <input value={form.chauffeur} onChange={(e) => setForm({ ...form, chauffeur: e.target.value })} className="amp-input text-sm" placeholder="Nom du chauffeur" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date et heure prévue *</label>
            <input type="datetime-local" value={form.datePlanifiee} onChange={(e) => setForm({ ...form, datePlanifiee: e.target.value })} className="amp-input text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Adresse de livraison</label>
            <input value={form.adresseLivraison} onChange={(e) => setForm({ ...form, adresseLivraison: e.target.value })} className="amp-input text-sm" placeholder="Adresse du chantier" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="amp-input text-sm resize-none" />
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
  const [form, setForm] = useState({ volumeLivre: livraison.commande?.volumeCommande || '', observations: '' });
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
            <input type="number" step="0.1" value={form.volumeLivre} onChange={(e) => setForm({ ...form, volumeLivre: e.target.value })} className="amp-input text-sm" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Observations</label>
            <textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} rows={3} className="amp-input text-sm resize-none" placeholder="Conditions de livraison, remarques client..." />
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

const LivraisonCard = ({ liv, onDemarrer, onLivrer, onAnnuler, canEdit }) => {
  const cfg = STATUT_CFG[liv.statut] || STATUT_CFG.PLANIFIEE;
  const isActive = liv.statut === 'EN_ROUTE';
  const canConfirm = liv.statut === 'EN_ROUTE';
  const canStart = liv.statut === 'PLANIFIEE';
  const canCancel = ['PLANIFIEE', 'EN_ROUTE'].includes(liv.statut);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('amp-card p-5', isActive && 'border-amber-300 shadow-amber-100 shadow-md')}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', isActive ? 'bg-amber-100' : 'bg-gray-100')}>
            <Truck size={20} className={isActive ? 'text-amber-600' : 'text-gray-500'} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-blue-700">{liv.reference}</span>
              <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>
                <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />{cfg.label}
              </span>
            </div>
            <p className="font-bold text-gray-800 mt-0.5">{liv.commande?.nomClient}</p>
            <p className="text-xs text-gray-500">{liv.commande?.reference} · {liv.commande?.volumeCommande} m³</p>
            {liv.adresseLivraison && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><MapPin size={10} />{liv.adresseLivraison}</p>
            )}
          </div>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs text-gray-400 flex items-center gap-1 justify-end"><Clock size={10} /> Prévu : {formatDateTime(liv.datePlanifiee)}</p>
          {liv.chauffeur && <p className="text-xs text-gray-500">Chauffeur : <span className="font-medium">{liv.chauffeur}</span></p>}
          {liv.equipement && <p className="text-xs text-gray-500">Toupie : <span className="font-medium">{liv.equipement.nom}</span></p>}
          {liv.dateDepart && <p className="text-xs text-gray-400">Départ : {formatDateTime(liv.dateDepart)}</p>}
          {liv.dateLivraison && <p className="text-xs text-green-600 font-medium">Livré : {formatDateTime(liv.dateLivraison)}</p>}
          {liv.volumeLivre && <p className="text-xs font-bold text-gray-700">Volume livré : {liv.volumeLivre} m³</p>}
        </div>
      </div>

      {canEdit && (canStart || canConfirm || canCancel) && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          {canStart && (
            <button onClick={() => onDemarrer(liv.id)} className="flex items-center gap-1.5 text-xs bg-amber-100 hover:bg-amber-200 text-amber-700 px-3 py-1.5 rounded-lg font-medium">
              <Navigation size={12} /> Démarrer
            </button>
          )}
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

  const { data: livraisons, isLoading } = useQuery({
    queryKey: ['livraisons', filtre],
    queryFn: () => livraisonsAPI.lister(filtre ? { statut: filtre } : {}),
    select: (r) => r.data.data,
    refetchInterval: 30000,
  });

  const canEdit = hasPermission('livraison:write');

  const demarrer = async (id) => {
    try {
      await livraisonsAPI.demarrer(id);
      toast.success('Livraison démarrée — toupie en route');
      qc.invalidateQueries(['livraisons']);
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const annuler = async (id) => {
    if (!window.confirm('Annuler cette livraison ?')) return;
    try {
      await livraisonsAPI.annuler(id);
      toast.success('Livraison annulée');
      qc.invalidateQueries(['livraisons']);
    } catch (err) { toast.error('Erreur'); }
  };

  const onSuccess = () => {
    setShowForm(false);
    setLivrerTarget(null);
    qc.invalidateQueries(['livraisons']);
  };

  if (isLoading) return <PageLoader />;

  const enRoute = livraisons?.filter((l) => l.statut === 'EN_ROUTE') || [];

  return (
    <div className="space-y-5">
      {/* Alerte en route */}
      {enRoute.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 flex items-center gap-3">
          <Navigation size={18} className="text-amber-600 flex-shrink-0 animate-pulse" />
          <p className="text-sm text-amber-800 font-medium">
            {enRoute.length} toupie(s) en route : {enRoute.map((l) => l.chauffeur || l.equipement?.nom || l.reference).join(', ')}
          </p>
        </div>
      )}

      {/* KPIs dérivés */}
      {livraisons && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Planifiées', value: livraisons.filter((l) => l.statut === 'PLANIFIEE').length, color: 'text-blue-700' },
            { label: 'En route', value: livraisons.filter((l) => l.statut === 'EN_ROUTE').length, color: 'text-amber-700' },
            { label: 'Livrées', value: livraisons.filter((l) => l.statut === 'LIVREE').length, color: 'text-green-700' },
            { label: 'Volume livré (m³)', value: livraisons.filter((l) => l.volumeLivre).reduce((a, l) => a + (l.volumeLivre || 0), 0).toLocaleString('fr-FR'), color: 'text-gray-800' },
          ].map(({ label, value, color }) => (
            <div key={label} className="amp-stat-card">
              <p className="text-sm text-gray-500">{label}</p>
              <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filtres + bouton */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          {[['', 'Toutes'], ['PLANIFIEE', 'Planifiées'], ['EN_ROUTE', 'En route'], ['LIVREE', 'Livrées']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltre(v)} className={cn('px-3 py-2 text-sm font-medium', filtre === v ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
              {l}
            </button>
          ))}
        </div>
        {canEdit && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium ml-auto">
            <Plus size={15} /> Planifier livraison
          </button>
        )}
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
            onDemarrer={demarrer}
            onLivrer={setLivrerTarget}
            onAnnuler={annuler}
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
