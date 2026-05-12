import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, Plus, AlertTriangle, Settings, Clock, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { equipementsAPI } from '../api';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatMontant, formatDate } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

const TYPE_LABELS = { TOUPIE: '🚛 Toupie', POMPE_BETON: '💧 Pompe à béton', CHARGEUR: '🏗 Chargeur', GROUPE_ELECTROGENE: '⚡ Groupe élec.', CENTRALE_BETON: '🏭 Centrale', CAMION: '🚚 Camion', AUTRE: '🔧 Autre' };
const STATUT_CFG = {
  DISPONIBLE: { color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  EN_SERVICE: { color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500 animate-pulse' },
  MAINTENANCE: { color: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  PANNE: { color: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  HORS_SERVICE: { color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
};

const MaintenanceForm = ({ equipement, onSuccess, onClose }) => {
  const [form, setForm] = useState({ type: 'PREVENTIVE', description: '', cout: 0, dateDebut: new Date().toISOString().split('T')[0], technicien: '', fournisseur: '', observations: '' });
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
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2"><Wrench size={18} className="text-amber-600" /> Maintenance : {equipement.nom}</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="amp-input text-sm">
              {[['PREVENTIVE', 'Préventive'], ['CORRECTIVE', 'Corrective'], ['REVISION', 'Révision'], ['REPARATION', 'Réparation']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Description *</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="amp-input text-sm resize-none" required />
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
              <input value={form.technicien} onChange={(e) => setForm({ ...form, technicien: e.target.value })} className="amp-input text-sm" placeholder="Nom technicien" />
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

const EquipementCard = ({ equip, onMaintenance, onStatut, canEdit }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUT_CFG[equip.statut] || STATUT_CFG.DISPONIBLE;
  const pctUse = Math.min(100, (equip.heuresUtilisees / equip.dureeVieHeures) * 100);
  const alerte = equip.prochainRevisionH && equip.heuresUtilisees >= equip.prochainRevisionH;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn('amp-card overflow-hidden', alerte && 'border-amber-300')}>
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gray-700 rounded-xl flex items-center justify-center text-lg flex-shrink-0">
              {TYPE_LABELS[equip.type]?.split(' ')[0] || '🔧'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-gray-800">{equip.nom}</h3>
                <span className={cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />{equip.statut.replace('_', ' ')}
                </span>
                {alerte && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1"><AlertTriangle size={10} /> Révision requise</span>}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{TYPE_LABELS[equip.type]} · Code : {equip.code}</p>
              {equip.marque && <p className="text-xs text-gray-400">{equip.marque} {equip.modele}</p>}
            </div>
          </div>
          <div className="flex gap-1">
            {canEdit && (
              <>
                <select
                  value={equip.statut}
                  onChange={(e) => onStatut(equip.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                >
                  {Object.keys(STATUT_CFG).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
                <button onClick={() => onMaintenance(equip)} className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600 transition-colors" title="Maintenance">
                  <Wrench size={14} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* KPIs amortissement */}
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
            <div
              className={cn('h-2 rounded-full transition-all', pctUse > 80 ? 'bg-red-500' : pctUse > 60 ? 'bg-amber-500' : 'bg-blue-500')}
              style={{ width: `${pctUse}%` }}
            />
          </div>
        </div>

        {/* Toggle détails */}
        <button onClick={() => setExpanded((s) => !s)} className="mt-3 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Masquer' : 'Voir historique maintenances'}
        </button>
      </div>

      {/* Maintenances */}
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

const Equipements = () => {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [maintenanceTarget, setMaintenanceTarget] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');

  const { data: equipements, isLoading } = useQuery({
    queryKey: ['equipements', typeFilter],
    queryFn: () => equipementsAPI.lister({ type: typeFilter }),
    select: (r) => r.data.data,
  });

  const { data: amortissements } = useQuery({
    queryKey: ['amortissements'],
    queryFn: () => equipementsAPI.getAmortissements(),
    select: (r) => r.data.data,
  });

  const handleStatut = async (id, statut) => {
    try {
      await equipementsAPI.changerStatut(id, { statut });
      toast.success(`Statut mis à jour : ${statut}`);
      qc.invalidateQueries(['equipements']);
    } catch (err) { toast.error(err.response?.data?.message || 'Erreur'); }
  };

  if (isLoading) return <PageLoader />;

  const pannes = equipements?.filter((e) => e.statut === 'PANNE' || e.statut === 'MAINTENANCE') || [];
  const canEdit = hasPermission('equipement:write');

  return (
    <div className="space-y-5">
      {/* Alertes pannes */}
      {pannes.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700 font-medium">{pannes.length} équipement(s) en panne/maintenance : {pannes.map(e => e.nom).join(', ')}</p>
        </div>
      )}

      {/* KPIs amortissement global */}
      {amortissements && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="amp-stat-card">
            <p className="text-sm text-gray-500">Valeur d'acquisition totale</p>
            <p className="text-xl font-bold text-gray-800">{formatMontant(amortissements.valeurAcquisitionTotale)}</p>
          </div>
          <div className="amp-stat-card">
            <p className="text-sm text-gray-500">Valeur actuelle totale</p>
            <p className="text-xl font-bold text-green-700">{formatMontant(amortissements.valeurTotaleActuelle)}</p>
          </div>
          <div className="amp-stat-card">
            <p className="text-sm text-gray-500">Amortissement cumulé</p>
            <p className="text-xl font-bold text-orange-700">{formatMontant(amortissements.totalAmorti)}</p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="flex items-center gap-3">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="amp-input w-auto text-sm">
          <option value="">Tous les types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <p className="text-sm text-gray-500 ml-2">{equipements?.length || 0} équipement(s)</p>
      </div>

      {/* Grille */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {equipements?.map((e) => (
          <EquipementCard
            key={e.id}
            equip={e}
            onMaintenance={setMaintenanceTarget}
            onStatut={handleStatut}
            canEdit={canEdit}
          />
        ))}
      </div>

      {maintenanceTarget && (
        <MaintenanceForm
          equipement={maintenanceTarget}
          onSuccess={() => { setMaintenanceTarget(null); qc.invalidateQueries(['equipements']); }}
          onClose={() => setMaintenanceTarget(null)}
        />
      )}
    </div>
  );
};

export default Equipements;
