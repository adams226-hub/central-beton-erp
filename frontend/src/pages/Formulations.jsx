import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, FlaskConical, Edit, Trash2, History, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { formulationsAPI } from '../api';
import FormulationForm from '../components/formulations/FormulationForm';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatMontant, formatDate } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';

const FormulationCard = ({ formulation, onEdit, onDelete, canEdit, canDelete }) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showHistorique, setShowHistorique] = useState(false);

  const { data: historique } = useQuery({
    queryKey: ['formulation-historique', formulation.id],
    queryFn: () => formulationsAPI.getHistorique(formulation.id),
    select: (res) => res.data.data,
    enabled: showHistorique,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="amp-card overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <FlaskConical size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-800">{formulation.nom}</h3>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">v{formulation.version}</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{formulation.typeBeton} · {formulation.description || 'Béton prêt à l\'emploi'}</p>
              <p className="text-xs text-gray-400 mt-1">Créé par {formulation.createdBy?.prenom} {formulation.createdBy?.nom} · {formatDate(formulation.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={() => onEdit(formulation)} className="p-2 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors" title="Modifier">
                <Edit size={15} />
              </button>
            )}
            {canDelete && (
              <button onClick={() => onDelete(formulation.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="Supprimer">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Coût unitaire */}
        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Coût / m³</p>
            <p className="font-bold text-green-700 text-sm">{formatMontant(formulation.coutUnitaire)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Ciment</p>
            <p className="font-semibold text-gray-700 text-sm">{+(formulation.ciment * 1000).toFixed(0)} kg/m³</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Powerflow</p>
            <p className="font-semibold text-gray-700 text-sm">{formulation.powerflow} L/m³</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-[10px] text-gray-500 uppercase">Eau</p>
            <p className="font-semibold text-gray-700 text-sm">{formulation.eau} L/m³</p>
          </div>
        </div>

        {/* Actions expand */}
        <div className="mt-3 flex gap-2">
          <button onClick={() => setShowDetails((s) => !s)} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium">
            {showDetails ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            {showDetails ? 'Masquer' : 'Voir tous les dosages'}
          </button>
          <button onClick={() => setShowHistorique((s) => !s)} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <History size={13} /> Historique
          </button>
        </div>
      </div>

      {/* Détails dosages */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50">
              {[
                { label: 'Ciment',        value: `${+(formulation.ciment    *1000).toFixed(0)} kg/m³`,  prix: `${formatMontant(formulation.prixCiment)}/t` },
                { label: 'Sable',         value: `${+(formulation.sable).toFixed(4)} m³/m³`,            prix: `${formatMontant(formulation.prixSable)}/m³` },
                { label: 'Gravier 5/15',  value: `${+(formulation.gravier515*1000).toFixed(0)} kg/m³`,  prix: `${formatMontant(formulation.prixGravier515)}/t` },
                { label: 'Gravier 15/25', value: `${+(formulation.gravier1525*1000).toFixed(0)} kg/m³`, prix: `${formatMontant(formulation.prixGravier1525)}/t` },
                { label: 'Eau',           value: `${formulation.eau} L/m³`,                             prix: 'Inclus' },
                { label: 'Hydrofuge',     value: `${formulation.hydrofuge} L/m³`,                       prix: `${formatMontant(formulation.prixHydrofuge)}/L` },
                { label: 'Powerflow 6425',value: `${formulation.powerflow} L/m³`,                       prix: `${formatMontant(formulation.prixPowerflow)}/L` },
              ].map(({ label, value, prix }) => (
                <div key={label} className="bg-white rounded-lg p-2.5">
                  <p className="text-[10px] text-gray-400 uppercase">{label}</p>
                  <p className="text-sm font-semibold text-gray-800">{value}</p>
                  <p className="text-[10px] text-gray-400">{prix}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Historique */}
      <AnimatePresence>
        {showHistorique && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className="px-5 py-4 bg-gray-50">
              <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3">Historique des versions</h4>
              {!historique?.length ? (
                <p className="text-xs text-gray-400">Aucune modification</p>
              ) : (
                <div className="space-y-2">
                  {historique.map((h) => (
                    <div key={h.id} className="bg-white rounded-lg p-2.5 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700">Version {h.version}</span>
                        <span className="text-gray-400">{formatDate(h.createdAt)}</span>
                      </div>
                      <p className="text-gray-500">Par {h.modificateur?.prenom} {h.modificateur?.nom}</p>
                      {h.motifModif && <p className="text-blue-600 italic">"{h.motifModif}"</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const Formulations = () => {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const { data: formulations, isLoading } = useQuery({
    queryKey: ['formulations'],
    queryFn: () => formulationsAPI.lister(),
    select: (res) => res.data.data,
  });

  const handleDelete = async (id) => {
    if (!confirm('Désactiver cette formulation ?')) return;
    try {
      await formulationsAPI.supprimer(id);
      toast.success('Formulation désactivée');
      qc.invalidateQueries({ queryKey: ['formulations'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{formulations?.length || 0} formulation{formulations?.length !== 1 ? 's' : ''} active{formulations?.length !== 1 ? 's' : ''}</p>
        </div>
        {hasPermission('formulation:create') && (
          <button
            onClick={() => { setEditTarget(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <Plus size={16} /> Créer une formulation
          </button>
        )}
      </div>

      {/* Liste */}
      <div className="space-y-4">
        {formulations?.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <FlaskConical size={40} className="mx-auto mb-3 opacity-30" />
            <p>Aucune formulation. Créez-en une pour commencer.</p>
          </div>
        )}
        {formulations?.map((f) => (
          <FormulationCard
            key={f.id}
            formulation={f}
            onEdit={(f) => { setEditTarget(f); setShowForm(true); }}
            onDelete={handleDelete}
            canEdit={hasPermission('formulation:update')}
            canDelete={hasPermission('formulation:delete')}
          />
        ))}
      </div>

      {/* Modal formulaire */}
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
                <h2 className="text-lg font-bold text-gray-800">
                  {editTarget ? `Modifier "${editTarget.nom}"` : 'Nouvelle formulation'}
                </h2>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
              </div>
              <div className="p-6">
                <FormulationForm
                  formulation={editTarget}
                  onSuccess={() => { setShowForm(false); setEditTarget(null); qc.invalidateQueries({ queryKey: ['formulations'] }); }}
                  onCancel={() => { setShowForm(false); setEditTarget(null); }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Formulations;
