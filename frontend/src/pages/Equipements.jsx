import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, Plus, AlertTriangle, ChevronDown, ChevronUp, Pencil, Trash2, RotateCcw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { equipementsAPI } from '../api';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatMontant, formatDate } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const TYPE_LABELS = {
  TOUPIE: '🚛 Toupie', POMPE_BETON: '💧 Pompe à béton', CHARGEUR: '🏗 Chargeur',
  GROUPE_ELECTROGENE: '⚡ Groupe élec.', CENTRALE_BETON: '🏭 Centrale', CAMION: '🚚 Camion', AUTRE: '🔧 Autre',
};
const STATUT_CFG = {
  DISPONIBLE:   { color: 'bg-green-100 text-green-800',  dot: 'bg-green-500' },
  EN_SERVICE:   { color: 'bg-blue-100 text-blue-800',    dot: 'bg-blue-500 animate-pulse' },
  MAINTENANCE:  { color: 'bg-amber-100 text-amber-800',  dot: 'bg-amber-500' },
  PANNE:        { color: 'bg-red-100 text-red-800',      dot: 'bg-red-500' },
  HORS_SERVICE: { color: 'bg-gray-100 text-gray-700',    dot: 'bg-gray-400' },
};

/* ─── Formulaire Équipement (Création + Édition) ─── */
const EquipementForm = ({ initial, onSuccess, onClose }) => {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    nom: initial?.nom || '',
    code: initial?.code || '',
    type: initial?.type || 'TOUPIE',
    marque: initial?.marque || '',
    modele: initial?.modele || '',
    numeroSerie: initial?.numeroSerie || '',
    anneeAchat: initial?.anneeAchat || '',
    coutAcquisition: initial?.coutAcquisition || '',
    dureeVieHeures: initial?.dureeVieHeures || '',
    heuresRevision: initial?.heuresRevision || '',
    consoCarburantHeure: initial?.consoCarburantHeure || '',
  });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nom || !form.code || !form.coutAcquisition || !form.dureeVieHeures) {
      return toast.error('Nom, code, coût et durée de vie sont obligatoires');
    }
    setLoading(true);
    try {
      if (isEdit) {
        await equipementsAPI.modifier(initial.id, form);
        toast.success('Équipement mis à jour');
      } else {
        await equipementsAPI.creer(form);
        toast.success('Équipement créé');
      }
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Wrench size={18} className="text-blue-600" />
            {isEdit ? `Modifier : ${initial.nom}` : 'Nouvel équipement'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Identification */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
              <input value={form.nom} onChange={(e) => set('nom', e.target.value)} className="amp-input text-sm" placeholder="Ex : Toupie BFM-03" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Code unique *</label>
              <input value={form.code} onChange={(e) => set('code', e.target.value)} className="amp-input text-sm" placeholder="Ex : TOUPIE-03" required disabled={isEdit} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className="amp-input text-sm">
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Marque</label>
              <input value={form.marque} onChange={(e) => set('marque', e.target.value)} className="amp-input text-sm" placeholder="Ex : LIEBHERR" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Modèle</label>
              <input value={form.modele} onChange={(e) => set('modele', e.target.value)} className="amp-input text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">N° Série</label>
              <input value={form.numeroSerie} onChange={(e) => set('numeroSerie', e.target.value)} className="amp-input text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Année d'achat</label>
              <input type="number" value={form.anneeAchat} onChange={(e) => set('anneeAchat', e.target.value)} className="amp-input text-sm" placeholder="2024" min="2000" max="2030" />
            </div>
          </div>

          {/* Amortissement */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Amortissement</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Coût d'acquisition (FCFA) *</label>
                <input type="number" value={form.coutAcquisition} onChange={(e) => set('coutAcquisition', e.target.value)} className="amp-input text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Durée de vie (heures) *</label>
                <input type="number" value={form.dureeVieHeures} onChange={(e) => set('dureeVieHeures', e.target.value)} className="amp-input text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Révision tous les (heures)</label>
                <input type="number" value={form.heuresRevision} onChange={(e) => set('heuresRevision', e.target.value)} className="amp-input text-sm" placeholder="500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Conso. carburant (L/heure)</label>
                <input type="number" step="0.1" value={form.consoCarburantHeure} onChange={(e) => set('consoCarburantHeure', e.target.value)} className="amp-input text-sm" placeholder="8" />
              </div>
            </div>
          </div>

          {form.coutAcquisition && form.dureeVieHeures && (
            <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
              Coût horaire calculé : <strong>{Math.round(parseFloat(form.coutAcquisition) / parseFloat(form.dureeVieHeures)).toLocaleString('fr-FR')} FCFA/h</strong>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-60">
              {loading ? 'Enregistrement...' : isEdit ? 'Mettre à jour' : 'Créer l\'équipement'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium text-sm">
              Annuler
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* ─── Formulaire Maintenance ─── */
const MaintenanceForm = ({ equipement, onSuccess, onClose }) => {
  const [form, setForm] = useState({
    type: 'PREVENTIVE', description: '', cout: 0,
    dateDebut: new Date().toISOString().split('T')[0], technicien: '', fournisseur: '', observations: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await equipementsAPI.enregistrerMaintenance(equipement.id, form);
      toast.success('Maintenance enregistrée');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Wrench size={18} className="text-amber-600" /> Maintenance : {equipement.nom}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="amp-input text-sm">
              {[['PREVENTIVE','Préventive'],['CORRECTIVE','Corrective'],['REVISION','Révision'],['REPARATION','Réparation']].map(([v,l]) =>
                <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2} className="amp-input text-sm resize-none" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Coût (FCFA)</label>
              <input type="number" value={form.cout} onChange={(e) => setForm({ ...form, cout: e.target.value })} className="amp-input text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date début *</label>
              <input type="date" value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} className="amp-input text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Technicien</label>
              <input value={form.technicien} onChange={(e) => setForm({ ...form, technicien: e.target.value })} className="amp-input text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Fournisseur</label>
              <input value={form.fournisseur} onChange={(e) => setForm({ ...form, fournisseur: e.target.value })} className="amp-input text-sm" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-lg font-medium text-sm disabled:opacity-60">
              {loading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium text-sm">Annuler</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

/* ─── Carte Équipement ─── */
const EquipementCard = ({ equip, onMaintenance, onEdit, onDesactiver, onReactiver, onStatut, canEdit }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUT_CFG[equip.statut] || STATUT_CFG.DISPONIBLE;
  const pctUse = Math.min(100, (equip.heuresUtilisees / equip.dureeVieHeures) * 100);
  const alerte = equip.prochainRevisionH && equip.heuresUtilisees >= equip.prochainRevisionH;
  const inactif = !equip.isActive;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={cn('amp-card overflow-hidden', alerte && 'border-amber-300', inactif && 'opacity-60 border-dashed')}>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
              {TYPE_LABELS[equip.type]?.split(' ')[0] || '🔧'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-800">{equip.nom}</h3>
                {inactif ? (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Désactivé</span>
                ) : (
                  <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />{equip.statut.replace(/_/g, ' ')}
                  </span>
                )}
                {alerte && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><AlertTriangle size={10} /> Révision requise</span>}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{TYPE_LABELS[equip.type]} · Code : {equip.code}</p>
              {equip.marque && <p className="text-xs text-gray-400">{equip.marque} {equip.modele}</p>}
            </div>
          </div>

          {canEdit && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {!inactif && (
                <select
                  value={equip.statut}
                  onChange={(e) => onStatut(equip.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                >
                  {Object.keys(STATUT_CFG).map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
              )}
              <button onClick={() => onEdit(equip)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600" title="Modifier">
                <Pencil size={13} />
              </button>
              {!inactif && (
                <button onClick={() => onMaintenance(equip)} className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600" title="Maintenance">
                  <Wrench size={13} />
                </button>
              )}
              {inactif ? (
                <button onClick={() => onReactiver(equip.id)} className="p-1.5 hover:bg-green-50 rounded-lg text-green-600" title="Réactiver">
                  <RotateCcw size={13} />
                </button>
              ) : (
                <button onClick={() => onDesactiver(equip.id, equip.nom)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500" title="Désactiver">
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-400 uppercase">Heures utilisées</p>
            <p className="text-sm font-bold text-gray-700">{equip.heuresUtilisees.toLocaleString('fr-FR')} h</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-400 uppercase">Coût/heure</p>
            <p className="text-sm font-bold text-blue-700">{formatMontant(equip.coutHoraire)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-400 uppercase">Valeur actuelle</p>
            <p className="text-sm font-bold text-green-700">{formatMontant(equip.valeurActuelle)}</p>
          </div>
        </div>

        {/* Barre amortissement */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Amortissement : {pctUse.toFixed(1)}%</span>
            <span>Durée vie : {equip.dureeVieHeures.toLocaleString('fr-FR')} h</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className={cn('h-2 rounded-full transition-all', pctUse > 80 ? 'bg-red-500' : pctUse > 60 ? 'bg-amber-500' : 'bg-blue-500')}
              style={{ width: `${pctUse}%` }} />
          </div>
        </div>

        <button onClick={() => setExpanded((s) => !s)} className="mt-3 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Masquer' : 'Voir historique maintenances'}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-gray-100">
            <div className="p-4 bg-gray-50 space-y-2">
              <p className="text-xs font-semibold text-gray-600 uppercase">Historique maintenances ({equip.maintenances?.length || 0})</p>
              {equip.maintenances?.length === 0 ? (
                <p className="text-xs text-gray-400">Aucune maintenance enregistrée</p>
              ) : equip.maintenances?.slice(0, 5).map((m) => (
                <div key={m.id} className="bg-white rounded-lg p-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-700">{m.type} — {m.description.substring(0, 50)}</span>
                    <span className="text-gray-400">{formatDate(m.dateDebut)}</span>
                  </div>
                  <p className="text-gray-500">Coût : {formatMontant(m.cout)} {m.technicien ? `· ${m.technicien}` : ''}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/* ─── Page principale ─── */
const Equipements = () => {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [maintenanceTarget, setMaintenanceTarget] = useState(null);
  const [formTarget, setFormTarget] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [showInactifs, setShowInactifs] = useState(false);

  const { data: equipements, isLoading } = useQuery({
    queryKey: ['equipements', typeFilter, showInactifs],
    queryFn: () => equipementsAPI.lister({ type: typeFilter || undefined, isActive: showInactifs ? undefined : true }),
    select: (r) => r.data.data,
  });

  const { data: amortissements } = useQuery({
    queryKey: ['amortissements'],
    queryFn: () => equipementsAPI.getAmortissements(),
    select: (r) => r.data.data,
  });

  const refresh = () => { qc.invalidateQueries(['equipements']); qc.invalidateQueries(['amortissements']); };

  const handleStatut = async (id, statut) => {
    try {
      await equipementsAPI.changerStatut(id, { statut });
      toast.success(`Statut : ${statut}`);
      refresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const handleDesactiver = async (id, nom) => {
    if (!window.confirm(`Désactiver "${nom}" ? Il ne sera plus utilisable en production.`)) return;
    try {
      await equipementsAPI.desactiver(id);
      toast.success('Équipement désactivé');
      refresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  const handleReactiver = async (id) => {
    try {
      await equipementsAPI.reactiver(id);
      toast.success('Équipement réactivé');
      refresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  if (isLoading) return <PageLoader />;

  const pannes = equipements?.filter((e) => e.isActive && (e.statut === 'PANNE' || e.statut === 'MAINTENANCE')) || [];
  const canEdit = hasPermission('equipement:write');

  return (
    <div className="space-y-5">
      {/* Alertes pannes */}
      {pannes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">{pannes.length} équipement(s) en panne/maintenance : {pannes.map((e) => e.nom).join(', ')}</p>
        </div>
      )}

      {/* KPIs */}
      {amortissements && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Valeur acquisition totale', value: formatMontant(amortissements.valeurAcquisitionTotale), color: 'text-gray-800' },
            { label: 'Valeur actuelle totale',     value: formatMontant(amortissements.valeurTotaleActuelle),   color: 'text-green-700' },
            { label: 'Amortissement cumulé',        value: formatMontant(amortissements.totalAmorti),            color: 'text-orange-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="amp-stat-card">
              <p className="text-sm text-gray-500">{label}</p>
              <p className={cn('text-xl font-bold mt-1', color)}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="amp-input w-auto text-sm">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={showInactifs} onChange={(e) => setShowInactifs(e.target.checked)} className="rounded" />
          Afficher désactivés
        </label>
        <p className="text-sm text-gray-500">{equipements?.length || 0} équipement(s)</p>
        {canEdit && (
          <button onClick={() => setFormTarget({})} className="ml-auto flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={15} /> Nouvel équipement
          </button>
        )}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {equipements?.map((e) => (
          <EquipementCard
            key={e.id} equip={e}
            onMaintenance={setMaintenanceTarget}
            onEdit={setFormTarget}
            onDesactiver={handleDesactiver}
            onReactiver={handleReactiver}
            onStatut={handleStatut}
            canEdit={canEdit}
          />
        ))}
        {equipements?.length === 0 && (
          <div className="col-span-2 text-center py-16 text-gray-400">Aucun équipement trouvé</div>
        )}
      </div>

      {/* Modales */}
      {formTarget !== null && (
        <EquipementForm
          initial={formTarget?.id ? formTarget : null}
          onSuccess={() => { setFormTarget(null); refresh(); }}
          onClose={() => setFormTarget(null)}
        />
      )}
      {maintenanceTarget && (
        <MaintenanceForm
          equipement={maintenanceTarget}
          onSuccess={() => { setMaintenanceTarget(null); refresh(); }}
          onClose={() => setMaintenanceTarget(null)}
        />
      )}
    </div>
  );
};

export default Equipements;
