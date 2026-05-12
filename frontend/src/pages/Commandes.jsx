import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Filter, Download, Eye, CheckCircle, XCircle,
  ChevronDown, RefreshCw, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { commandesAPI } from '../api';
import StatusBadge from '../components/common/StatusBadge';
import CommandeForm from '../components/commandes/CommandeForm';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatMontant, formatDate, formatVolume, STATUT_CONFIG } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const STATUTS = Object.keys(STATUT_CONFIG);

const Commandes = () => {
  const { hasPermission, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statutFilter, setStatutFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [rejectId, setRejectId] = useState(null);
  const [rejectMotif, setRejectMotif] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['commandes', search, statutFilter],
    queryFn: () => commandesAPI.lister({ search, statut: statutFilter }),
    select: (res) => res.data.data,
  });

  const commandes = data?.commandes || [];
  const total = data?.total || 0;

  const handleValider = async (id, e) => {
    e.stopPropagation();
    setActionLoading(id + '_val');
    try {
      await commandesAPI.valider(id, { commentaire: '' });
      toast.success('Commande validée');
      qc.invalidateQueries(['commandes']);
      qc.invalidateQueries(['statistiques']);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de validation');
    } finally { setActionLoading(null); }
  };

  const handleRejeter = async () => {
    if (!rejectMotif.trim()) return toast.error('Motif de rejet requis');
    setActionLoading(rejectId + '_rej');
    try {
      await commandesAPI.rejeter(rejectId, { motif: rejectMotif });
      toast.success('Commande rejetée');
      qc.invalidateQueries(['commandes']);
      qc.invalidateQueries(['statistiques']);
      setRejectId(null); setRejectMotif('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setActionLoading(null); }
  };

  const handleDownloadPDF = async (id, ref, e) => {
    e.stopPropagation();
    try {
      const res = await commandesAPI.telechargerPDF(id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `devis-${ref}.pdf`; a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF téléchargé');
    } catch { toast.error('Erreur génération PDF'); }
  };

  const canValidate = (cmd) => {
    const mapRoleStatut = {
      SECRETAIRE: 'EN_ATTENTE_SECRETAIRE',
      CHEF_DE_SITE: 'EN_ATTENTE_CHEF_SITE',
      PDG: 'EN_ATTENTE_PDG',
    };
    return hasPermission('commande:validate') && cmd.statut === mapRoleStatut[user?.role];
  };

  const canReject = (cmd) => {
    return hasPermission('commande:reject') && ['EN_ATTENTE_SECRETAIRE', 'EN_ATTENTE_CHEF_SITE', 'EN_ATTENTE_PDG'].includes(cmd.statut);
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher client, référence, chantier..."
            className="amp-input pl-9 text-sm"
          />
        </div>
        <select
          value={statutFilter}
          onChange={(e) => setStatutFilter(e.target.value)}
          className="amp-input w-auto text-sm min-w-[180px]"
        >
          <option value="">Tous les statuts</option>
          {STATUTS.map((s) => <option key={s} value={s}>{STATUT_CONFIG[s].label}</option>)}
        </select>
        <button onClick={() => refetch()} className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
          <RefreshCw size={16} />
        </button>
        {hasPermission('commande:create') && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Nouvelle commande
          </button>
        )}
      </div>

      <p className="text-sm text-gray-500">{total} commande{total !== 1 ? 's' : ''} trouvée{total !== 1 ? 's' : ''}</p>

      {/* Table */}
      <div className="amp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Référence', 'Client', 'Chantier', 'Volume', 'Type', 'Montant', 'Statut', 'Date', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {commandes.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center py-16 text-gray-400">
                    <FileText size={40} className="mx-auto mb-3 opacity-30" />
                    <p>Aucune commande trouvée</p>
                  </td>
                </tr>
              )}
              {commandes.map((cmd, i) => (
                <motion.tr
                  key={cmd.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => navigate(`/commandes/${cmd.id}`)}
                  className="table-row-hover"
                >
                  <td className="px-4 py-3 font-mono text-xs text-blue-700 font-semibold whitespace-nowrap">{cmd.reference}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800">{cmd.nomClient}</p>
                    <p className="text-xs text-gray-400">{cmd.telephone}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[150px]">
                    <p className="truncate text-xs">{cmd.adresseChantier}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium whitespace-nowrap">{formatVolume(cmd.volumeBeton)}</td>
                  <td className="px-4 py-3">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">{cmd.typeBeton}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-xs">
                    {cmd.montantCommande ? formatMontant(cmd.montantCommande) : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap"><StatusBadge statut={cmd.statut} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDate(cmd.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/commandes/${cmd.id}`); }}
                        className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors"
                        title="Voir"
                      >
                        <Eye size={14} />
                      </button>
                      {canValidate(cmd) && (
                        <button
                          onClick={(e) => handleValider(cmd.id, e)}
                          disabled={actionLoading === cmd.id + '_val'}
                          className="p-1.5 hover:bg-green-50 rounded-lg text-green-600 transition-colors disabled:opacity-50"
                          title="Valider"
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                      {canReject(cmd) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setRejectId(cmd.id); }}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                          title="Rejeter"
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => handleDownloadPDF(cmd.id, cmd.reference, e)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
                        title="Télécharger PDF"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal création commande */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            >
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
                <h2 className="text-lg font-bold text-gray-800">Nouvelle commande</h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 p-1">✕</button>
              </div>
              <div className="p-6">
                <CommandeForm
                  onSuccess={() => { setShowForm(false); qc.invalidateQueries(['commandes']); qc.invalidateQueries(['statistiques']); }}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal rejet */}
      <AnimatePresence>
        {rejectId && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
            >
              <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <XCircle size={18} className="text-red-500" /> Rejeter la commande
              </h3>
              <label className="block text-sm font-medium text-gray-700 mb-2">Motif du rejet *</label>
              <textarea
                value={rejectMotif}
                onChange={(e) => setRejectMotif(e.target.value)}
                rows={3}
                placeholder="Expliquer la raison du rejet..."
                className="amp-input resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleRejeter}
                  disabled={!rejectMotif.trim() || actionLoading}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm disabled:opacity-60"
                >
                  Confirmer le rejet
                </button>
                <button onClick={() => { setRejectId(null); setRejectMotif(''); }} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-medium text-sm">
                  Annuler
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Commandes;
