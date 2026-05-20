import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CreditCard, Plus, CheckCircle, AlertTriangle, Clock, TrendingUp, FileDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { paiementsAPI, commandesAPI } from '../api';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatMontant, formatDate } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const MODE_LABELS = { ESPECE: '💵 Espèces', VIREMENT: '🏦 Virement', CHEQUE: '📝 Chèque', CREDIT_CLIENT: '💳 Crédit', MOBILE_MONEY: '📱 Mobile Money' };
const STATUT_CFG = {
  EN_ATTENTE: { color: 'bg-amber-100 text-amber-800', label: 'En attente' },
  PARTIEL: { color: 'bg-blue-100 text-blue-800', label: 'Partiel' },
  PAYE: { color: 'bg-green-100 text-green-800', label: 'Payé' },
  RETARD: { color: 'bg-red-100 text-red-800', label: 'En retard' },
  ANNULE: { color: 'bg-gray-100 text-gray-700', label: 'Annulé' },
};

const PaiementForm = ({ onSuccess, onClose }) => {
  const [form, setForm] = useState({ commandeId: '', montant: '', modePaiement: 'ESPECE', statut: 'EN_ATTENTE', reference_ext: '', banque: '', dateEcheance: '', notes: '' });
  const [loading, setLoading] = useState(false);

  const { data: commandes, isLoading: cmdLoading } = useQuery({
    queryKey: ['commandes-paiement'],
    queryFn: () => commandesAPI.lister({ limit: 200 }),
    select: (r) => {
      const list = r.data?.data?.commandes ?? [];
      return list.filter((c) => {
        if (!c.montantCommande || c.montantCommande <= 0) return false;
        if (!['VALIDEE', 'EN_PRODUCTION', 'LIVREE'].includes(c.statut)) return false;
        if (c.montantRestant !== null && c.montantRestant !== undefined && c.montantRestant <= 0) return false;
        return true;
      });
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.commandeId || !form.montant) return toast.error('Commande et montant requis');
    setLoading(true);
    try {
      await paiementsAPI.enregistrer(form);
      toast.success('Paiement enregistré');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Plus size={18} className="text-blue-600" /> Enregistrer un paiement</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Commande *</label>
            <select value={form.commandeId} onChange={(e) => setForm({ ...form, commandeId: e.target.value })} className="w-full amp-input text-sm" required>
              <option value="">— Sélectionner une commande —</option>
              {cmdLoading && <option disabled>Chargement...</option>}
              {!cmdLoading && commandes?.length === 0 && <option disabled>Aucune commande avec solde restant</option>}
              {commandes?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.reference} — {c.nomClient} — Reste: {c.montantRestant ? Math.round(c.montantRestant).toLocaleString() : '?'} FCFA
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Montant (FCFA) *</label>
              <input type="number" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} className="amp-input text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mode *</label>
              <select value={form.modePaiement} onChange={(e) => setForm({ ...form, modePaiement: e.target.value })} className="w-full amp-input text-sm">
                {Object.entries(MODE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Statut</label>
              <select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })} className="w-full amp-input text-sm">
                <option value="EN_ATTENTE">En attente</option>
                <option value="PAYE">Payé maintenant</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Échéance</label>
              <input type="date" value={form.dateEcheance} onChange={(e) => setForm({ ...form, dateEcheance: e.target.value })} className="amp-input text-sm" />
            </div>
          </div>
          {(form.modePaiement === 'CHEQUE' || form.modePaiement === 'VIREMENT') && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">N° référence</label>
                <input value={form.reference_ext} onChange={(e) => setForm({ ...form, reference_ext: e.target.value })} className="amp-input text-sm" placeholder="N° chèque / virement" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Banque</label>
                <input value={form.banque} onChange={(e) => setForm({ ...form, banque: e.target.value })} className="amp-input text-sm" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="amp-input text-sm resize-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-60">
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium text-sm">Annuler</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const Paiements = () => {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [view, setView] = useState('liste');

  const { data: paiements, isLoading } = useQuery({
    queryKey: ['paiements'],
    queryFn: () => paiementsAPI.lister(),
    select: (r) => r.data.data,
  });

  const { data: stats } = useQuery({
    queryKey: ['paiements-stats'],
    queryFn: () => paiementsAPI.getStatistiques(),
    select: (r) => r.data.data,
  });

  const { data: creances } = useQuery({
    queryKey: ['creances'],
    queryFn: () => paiementsAPI.getCreances(),
    select: (r) => r.data.data,
    enabled: view === 'creances',
  });

  const confirmer = async (id) => {
    try {
      await paiementsAPI.confirmer(id);
      toast.success('Paiement confirmé');
      qc.invalidateQueries(['paiements', 'paiements-stats']);
    } catch (err) { toast.error('Erreur'); }
  };

  const exportEtatPaiement = async (commandeId, nomClient) => {
    if (!commandeId) return toast.error('Commande introuvable');
    const toastId = toast.loading('Génération état de paiement...');
    try {
      const res = await paiementsAPI.exportEtatPaiement(commandeId);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `etat-paiement-${nomClient || commandeId}.pdf`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('État de paiement téléchargé', { id: toastId });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur export', { id: toastId });
    }
  };

  if (isLoading) return <PageLoader />;

  const onSuccess = () => { setShowForm(false); qc.invalidateQueries(['paiements', 'paiements-stats', 'creances']); };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Encaissé total', value: formatMontant(stats.totalEncaisse), color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle },
            { label: 'Encaissé ce mois', value: formatMontant(stats.encaisseMois), color: 'text-blue-700', bg: '', icon: TrendingUp },
            { label: 'En attente', value: formatMontant(stats.enAttente), color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock },
            { label: 'Paiements en retard', value: `${stats.enRetard} éch.`, color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: AlertTriangle },
          ].map(({ label, value, color, bg, icon: Icon }) => (
            <div key={label} className={cn('amp-stat-card border', bg)}>
              <div className="flex justify-between items-start">
                <div><p className="text-sm text-gray-500">{label}</p><p className={cn('text-xl font-bold mt-1', color)}>{value}</p></div>
                <Icon size={18} className={color} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Onglets */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          {[['liste', 'Paiements'], ['creances', 'Créances']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} className={cn('px-4 py-2 text-sm font-medium', view === v ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
              {l}
            </button>
          ))}
        </div>
        {hasPermission('paiement:write') && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium ml-auto">
            <Plus size={15} /> Nouveau paiement
          </button>
        )}
      </div>

      {/* Vue liste paiements */}
      {view === 'liste' && (
        <div className="amp-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{['Réf.', 'Client / Commande', 'Montant', 'Mode', 'Statut', 'Date', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paiements?.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">Aucun paiement</td></tr>}
              {paiements?.map((p) => {
                const cfg = STATUT_CFG[p.statut] || STATUT_CFG.EN_ATTENTE;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-blue-700">{p.reference}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{p.commande?.nomClient}</p>
                      <p className="text-xs text-gray-400">{p.commande?.reference}</p>
                    </td>
                    <td className="px-4 py-3 font-bold text-gray-800">{formatMontant(p.montant)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{MODE_LABELS[p.modePaiement]}</td>
                    <td className="px-4 py-3"><span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>{cfg.label}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {p.statut === 'EN_ATTENTE' && hasPermission('paiement:write') && (
                          <button onClick={() => confirmer(p.id)} className="text-xs bg-green-100 hover:bg-green-200 text-green-700 px-2 py-1 rounded font-medium">
                            ✓ Confirmer
                          </button>
                        )}
                        {p.commande?.id || p.commandeId ? (
                          <button
                            onClick={() => exportEtatPaiement(p.commande?.id || p.commandeId, p.commande?.nomClient)}
                            className="flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium"
                            title="État de paiement PDF"
                          >
                            <FileDown size={11} /> État
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Vue créances */}
      {view === 'creances' && (
        <div className="space-y-3">
          {creances?.length === 0 && <p className="text-center text-gray-400 py-12">Aucune créance en cours</p>}
          {creances?.map((c) => (
            <div key={c.id} className={cn('amp-card p-4 border', c.enRetard ? 'border-red-300 bg-red-50/50' : '')}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-blue-700">{c.reference}</span>
                    {c.enRetard && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">⚠ Retard {c.joursDepuisLivraison}j</span>}
                  </div>
                  <p className="font-semibold text-gray-800">{c.nomClient}</p>
                  <p className="text-xs text-gray-500">Tél : {c.telephone}</p>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm text-gray-500">Montant : {formatMontant(c.montantCommande)}</p>
                  <p className="text-sm font-medium text-green-700">Payé : {formatMontant(c.totalPaye)}</p>
                  <p className="text-lg font-bold text-red-700">Reste : {formatMontant(c.resteAPayer)}</p>
                  <button
                    onClick={() => exportEtatPaiement(c.id, c.nomClient)}
                    className="inline-flex items-center gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-medium"
                  >
                    <FileDown size={12} /> État de paiement PDF
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <PaiementForm onSuccess={onSuccess} onClose={() => setShowForm(false)} />}
    </div>
  );
};

export default Paiements;
