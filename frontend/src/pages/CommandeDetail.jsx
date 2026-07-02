import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Download, CheckCircle, XCircle, Edit, User,
  MapPin, Phone, Calendar, Layers, Calculator, Clock, FileText,
  Truck, CreditCard, Factory, Activity, TrendingUp, Package, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { commandesAPI } from '../api';
import StatusBadge from '../components/common/StatusBadge';
import CommandeForm from '../components/commandes/CommandeForm';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatMontant, formatDate, formatDateTime, formatVolume, ROLE_LABELS } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';

// ── Config statuts ────────────────────────────────────────────────────────────
const PROD_STATUT = {
  EN_ATTENTE:  { label: 'En attente',  color: 'bg-gray-100 text-gray-600' },
  EN_COURS:    { label: 'En cours',    color: 'bg-blue-100 text-blue-700' },
  CHARGEMENT:  { label: 'Chargement', color: 'bg-amber-100 text-amber-700' },
  LIVRAISON:   { label: 'Livraison',  color: 'bg-purple-100 text-purple-700' },
  TERMINE:     { label: 'Terminée',   color: 'bg-green-100 text-green-700' },
  ANNULE:      { label: 'Annulée',    color: 'bg-red-100 text-red-700' },
};
const LIV_STATUT = {
  PLANIFIEE: { label: 'Planifiée', color: 'bg-gray-100 text-gray-600' },
  EN_ROUTE:  { label: 'En route',  color: 'bg-blue-100 text-blue-700' },
  LIVREE:    { label: 'Livrée',    color: 'bg-green-100 text-green-700' },
  RETARD:    { label: 'Retard',    color: 'bg-amber-100 text-amber-700' },
  ANNULEE:   { label: 'Annulée',  color: 'bg-red-100 text-red-700' },
};
const PAY_STATUT = {
  EN_ATTENTE: { label: 'En attente', color: 'bg-amber-100 text-amber-700' },
  PARTIEL:    { label: 'Partiel',    color: 'bg-blue-100 text-blue-700' },
  PAYE:       { label: 'Payé',       color: 'bg-green-100 text-green-700' },
  RETARD:     { label: 'Retard',     color: 'bg-red-100 text-red-700' },
  ANNULE:     { label: 'Annulé',     color: 'bg-gray-100 text-gray-500' },
};
const PAY_MODE = {
  ESPECE:       '💵 Espèces',
  VIREMENT:     '🏦 Virement',
  CHEQUE:       '📝 Chèque',
  CREDIT_CLIENT:'💳 Crédit client',
  MOBILE_MONEY: '📱 Mobile Money',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const ETAPES_STATUT = [
  { label: 'Créée',        statuts: ['BROUILLON'] },
  { label: 'En validation',statuts: ['EN_ATTENTE_SECRETAIRE','EN_ATTENTE_CHEF_SITE','EN_ATTENTE_ASSISTANT_COMPTABLE','EN_ATTENTE_CHEF_COMPTABLE','EN_ATTENTE_PDG'] },
  { label: 'Validée',      statuts: ['VALIDEE'] },
  { label: 'Production',   statuts: ['EN_PRODUCTION'] },
  { label: 'Livrée',       statuts: ['LIVREE'] },
];

const getProgressStep = (statut) => {
  const idx = ETAPES_STATUT.findIndex((e) => e.statuts.includes(statut));
  return idx === -1 ? 0 : idx;
};

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
      <Icon size={15} className="text-blue-600" />
    </div>
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || '-'}</p>
    </div>
  </div>
);

const Badge = ({ cfg, label }) => (
  <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg?.color || 'bg-gray-100 text-gray-500')}>
    {cfg?.label || label}
  </span>
);

// ── Composant principal ───────────────────────────────────────────────────────
const CommandeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [rejectMotif, setRejectMotif] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showProformaModal, setShowProformaModal] = useState(false);
  const [proformaLignes, setProformaLignes] = useState([]);
  const [generatingProforma, setGeneratingProforma] = useState(false);

  const { data: commande, isLoading } = useQuery({
    queryKey: ['commande', id],
    queryFn: () => commandesAPI.getOne(id),
    select: (res) => res.data.data,
  });

  const handleValider = async () => {
    try {
      await commandesAPI.valider(id, { commentaire: '' });
      toast.success('Commande validée avec succès !');
      qc.invalidateQueries({ queryKey: ['commande', id] });
      qc.invalidateQueries({ queryKey: ['commandes'] });
      qc.invalidateQueries({ queryKey: ['statistiques'] });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  const handleSupprimer = async () => {
    setDeleting(true);
    try {
      await commandesAPI.supprimer(id);
      toast.success('Commande supprimée définitivement');
      navigate('/commandes');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de la suppression');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleRejeter = async () => {
    if (!rejectMotif.trim()) return toast.error('Motif requis');
    try {
      await commandesAPI.rejeter(id, { motif: rejectMotif });
      toast.success('Commande rejetée');
      qc.invalidateQueries({ queryKey: ['commande', id] });
      qc.invalidateQueries({ queryKey: ['commandes'] });
      setShowReject(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  const handlePDF = async () => {
    try {
      const res = await commandesAPI.telechargerPDF(id);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `devis-${commande.reference}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Erreur PDF'); }
  };

  const handleOpenProforma = () => {
    if (Array.isArray(commande.proformaLignes) && commande.proformaLignes.length > 0) {
      setProformaLignes(commande.proformaLignes);
    } else {
      const prixUnit = commande.volumeBeton > 0 ? Math.round((commande.montantCommande || 0) / commande.volumeBeton) : 0;
      setProformaLignes([
        { designation: `Béton de ${commande.typeBeton || commande.formulation?.typeBeton || 'C25/30'}`, unite: 'm3', quantite: commande.volumeBeton || 0, prixUnitaire: prixUnit, montant: commande.montantCommande || 0 },
      ]);
    }
    setShowProformaModal(true);
  };

  const handleProformaLigneMontant = (idx, field, value) => {
    setProformaLignes((prev) => {
      const updated = prev.map((l, i) => {
        if (i !== idx) return l;
        const next = { ...l, [field]: value };
        if (field === 'quantite' || field === 'prixUnitaire') {
          next.montant = Math.round((parseFloat(next.quantite) || 0) * (parseFloat(next.prixUnitaire) || 0));
        }
        return next;
      });
      return updated;
    });
  };

  const handleGenererProforma = async () => {
    setGeneratingProforma(true);
    try {
      const res = await commandesAPI.telechargerProformaCustom(id, proformaLignes);
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a'); a.href = url; a.download = `proforma-${commande.reference}.pdf`; a.click();
      URL.revokeObjectURL(url);
      setShowProformaModal(false);
    } catch { toast.error('Erreur génération proforma'); }
    finally { setGeneratingProforma(false); }
  };

  if (isLoading) return <PageLoader />;
  if (!commande) return <p className="text-center text-gray-400 py-20">Commande introuvable</p>;

  const mapRoleStatut = {
    SECRETAIRE: 'EN_ATTENTE_SECRETAIRE',
    CHEF_DE_SITE: 'EN_ATTENTE_CHEF_SITE',
    ASSISTANT_COMPTABLE: 'EN_ATTENTE_ASSISTANT_COMPTABLE',
    CHEF_COMPTABLE: 'EN_ATTENTE_CHEF_COMPTABLE',
    PDG: 'EN_ATTENTE_PDG',
  };
  const canValidate = hasPermission('commande:validate') && commande.statut === mapRoleStatut[user?.role];
  const canReject = hasPermission('commande:reject') && [
    'EN_ATTENTE_SECRETAIRE','EN_ATTENTE_CHEF_SITE',
    'EN_ATTENTE_ASSISTANT_COMPTABLE','EN_ATTENTE_CHEF_COMPTABLE','EN_ATTENTE_PDG',
  ].includes(commande.statut);
  const canEdit = hasPermission('commande:update') && ['BROUILLON','EN_ATTENTE_SECRETAIRE','REJETEE'].includes(commande.statut);
  const canDelete = hasPermission('commande:delete') && ['BROUILLON','ANNULEE','REJETEE'].includes(commande.statut);

  // Calculs paiements
  const totalCommande = commande.montantCommande || 0;
  const montantPaye = (commande.paiements || [])
    .filter((p) => p.statut === 'PAYE' || p.statut === 'PARTIEL')
    .reduce((s, p) => s + p.montant, 0);
  const montantRestant = Math.max(0, totalCommande - montantPaye);
  const pctPaye = totalCommande > 0 ? Math.min(100, (montantPaye / totalCommande) * 100) : 0;

  // Volume livré
  const volumeTotalLivre = (commande.livraisons || [])
    .filter((l) => l.statut === 'LIVREE')
    .reduce((s, l) => s + (l.volumeReel || l.volumePlanifie || 0), 0);
  const pctLivre = commande.volumeBeton > 0
    ? Math.min(100, (volumeTotalLivre / commande.volumeBeton) * 100)
    : 0;

  const progressStep = getProgressStep(commande.statut);
  const isAnnule = ['ANNULEE','REJETEE'].includes(commande.statut);

  if (editing) return (
    <div>
      <button onClick={() => setEditing(false)} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-5 text-sm">
        <ArrowLeft size={16} /> Retour aux détails
      </button>
      <div className="amp-card p-6">
        <h2 className="font-bold text-gray-800 text-lg mb-5">Modifier la commande {commande.reference}</h2>
        <CommandeForm
          commande={commande}
          onSuccess={() => { setEditing(false); qc.invalidateQueries({ queryKey: ['commande', id] }); }}
          onCancel={() => setEditing(false)}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/commandes')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-800 font-mono">{commande.reference}</h2>
              <StatusBadge statut={commande.statut} />
            </div>
            <p className="text-gray-400 text-xs mt-0.5">Créé le {formatDateTime(commande.createdAt)} par {commande.createdBy?.prenom} {commande.createdBy?.nom}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canEdit && (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm transition-colors">
              <Edit size={14} /> Modifier
            </button>
          )}
          <button onClick={handlePDF} className="flex items-center gap-1.5 border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg text-sm transition-colors">
            <Download size={14} /> Devis PDF
          </button>
          <button onClick={handleOpenProforma} className="flex items-center gap-1.5 border border-blue-200 hover:bg-blue-50 text-blue-700 px-3 py-2 rounded-lg text-sm transition-colors">
            <FileText size={14} /> Proforma PDF
          </button>
          {canValidate && (
            <button onClick={handleValider} className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <CheckCircle size={14} /> Valider
            </button>
          )}
          {canReject && (
            <button onClick={() => setShowReject(true)} className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <XCircle size={14} /> Rejeter
            </button>
          )}
          {canDelete && (
            <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-1.5 bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Trash2 size={14} /> Supprimer
            </button>
          )}
        </div>
      </div>

      {/* ── Infos / Calculs / Budget ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="amp-card p-5 space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide border-b border-gray-100 pb-3">Client</h3>
          <InfoRow icon={User}     label="Nom"             value={commande.nomClient} />
          <InfoRow icon={Phone}    label="Téléphone"       value={commande.telephone} />
          <InfoRow icon={MapPin}   label="Adresse chantier" value={commande.adresseChantier} />
          <InfoRow icon={Calendar} label="Date livraison"  value={formatDate(commande.dateLivraison)} />
          <InfoRow icon={Layers}   label="Type béton"      value={commande.typeBeton} />
          <InfoRow icon={FileText} label="Volume commandé" value={`${commande.volumeBeton} m³`} />
          {commande.observations && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Observations</p>
              <p className="text-sm text-gray-700">{commande.observations}</p>
            </div>
          )}
        </div>

        <div className="amp-card p-5">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
            <Calculator size={14} /> Calculs automatiques
          </h3>
          <div className="space-y-2">
            {[
              { label: 'Ciment total',  value: `${commande.totalCiment || 0} t` },
              { label: 'Gravier 5/15',  value: `${commande.totalGravier515 || 0} t` },
              { label: 'Gravier 15/25', value: `${commande.totalGravier1525 || 0} t` },
              { label: 'Sable naturel', value: `${commande.totalSable || 0} m³` },
              { label: 'Eau',           value: `${commande.totalEau || 0} L` },
              { label: 'Powerflow',     value: `${commande.totalPowerflow || 0} L` },
              { label: 'Gasoil total',  value: `${commande.totalGasoil || 0} L` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm font-semibold text-gray-800">{value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="amp-card p-5">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide border-b border-gray-100 pb-3 mb-4">Budget prévisionnel</h3>
          <div className="space-y-2">
            {[
              { label: 'Coût matériaux',    value: commande.coutMateriaux },
              { label: 'Coût gasoil',       value: commande.coutGasoil },
              { label: 'Amortissements',    value: commande.coutAmortissement },
              { label: 'Personnel',         value: commande.coutPersonnel,     hide: !commande.coutPersonnel },
              { label: 'Restauration',      value: commande.fraisRestauration, hide: !commande.fraisRestauration },
              { label: 'Frais de péage',    value: commande.coutPeage,         hide: !commande.coutPeage },
              { label: commande.autresFraisLabel || 'Autres frais', value: commande.coutAutres, hide: !commande.coutAutres },
            ].filter(r => !r.hide).map(({ label, value }) => (
              <div key={label} className="flex justify-between py-1 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm text-gray-800">{formatMontant(value)}</span>
              </div>
            ))}
            <div className="flex justify-between py-2 bg-blue-50 rounded-lg px-2 mt-2">
              <span className="text-sm font-semibold text-blue-800">Coût de production</span>
              <span className="text-sm font-bold text-blue-800">{formatMontant(commande.coutTotal)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-sm text-gray-600">Coût unitaire / m³</span>
              <span className="text-sm font-medium text-gray-800">{formatMontant(commande.coutUnitaire)}</span>
            </div>
            {commande.montantCommande && commande.volumeBeton > 0 && (
              <div className="flex justify-between py-1">
                <span className="text-sm text-gray-600">
                  Prix de vente / m³{commande.remisePct > 0 ? ` (remise ${commande.remisePct}% incluse)` : ''}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatMontant(Math.round(commande.montantCommande / commande.volumeBeton))}
                </span>
              </div>
            )}
            {commande.montantCommande && (() => {
              const remisePct = commande.remisePct || 0;
              const montantBrut = remisePct > 0
                ? Math.round(commande.montantCommande * 100 / (100 - remisePct))
                : commande.montantCommande;
              const deduction = montantBrut - commande.montantCommande;
              const adjCost = ((commande.useRetardateur ? 1 : 0) + (commande.useAccelerateur ? 1 : 0) + (commande.useHydrofuge ? 1 : 0)) * 10000 * (commande.volumeBeton || 0);
              const betonBase = montantBrut - adjCost;
              const hasAdj = adjCost > 0;
              return (
                <>
                  {hasAdj && (
                    <>
                      <div className="flex justify-between py-1 border-b border-gray-50">
                        <span className="text-sm text-gray-500">Béton {commande.typeBeton}</span>
                        <span className="text-sm text-gray-600">{formatMontant(betonBase)}</span>
                      </div>
                      {commande.useHydrofuge && (
                        <div className="flex justify-between py-1 border-b border-gray-50">
                          <span className="text-sm text-orange-600">+ Hydrofuge</span>
                          <span className="text-sm text-orange-600">+{formatMontant(10000 * commande.volumeBeton)}</span>
                        </div>
                      )}
                      {commande.useRetardateur && (
                        <div className="flex justify-between py-1 border-b border-gray-50">
                          <span className="text-sm text-orange-600">+ Retardateur de prise</span>
                          <span className="text-sm text-orange-600">+{formatMontant(10000 * commande.volumeBeton)}</span>
                        </div>
                      )}
                      {commande.useAccelerateur && (
                        <div className="flex justify-between py-1 border-b border-gray-50">
                          <span className="text-sm text-orange-600">+ Accélérateur de prise</span>
                          <span className="text-sm text-orange-600">+{formatMontant(10000 * commande.volumeBeton)}</span>
                        </div>
                      )}
                    </>
                  )}
                  {remisePct > 0 && (
                    <>
                      <div className="flex justify-between py-1 border-b border-gray-50">
                        <span className="text-sm text-gray-500">{hasAdj ? 'Sous-total HT' : 'Prix brut bordereau'}</span>
                        <span className="text-sm text-gray-600">{formatMontant(montantBrut)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-orange-100">
                        <span className="text-sm text-orange-700">Remise ({remisePct}%)</span>
                        <span className="text-sm font-medium text-orange-700">− {formatMontant(deduction)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between py-2 bg-gray-800 rounded-lg px-2 mt-2">
                    <span className="text-sm font-semibold text-white">Montant de vente</span>
                    <span className="text-sm font-bold text-white">{formatMontant(commande.montantCommande)}</span>
                  </div>
                  <div className={cn('flex justify-between py-2 rounded-lg px-2', commande.margePrevisionnelle >= 0 ? 'bg-green-50' : 'bg-red-50')}>
                    <span className={cn('text-sm font-semibold', commande.margePrevisionnelle >= 0 ? 'text-green-800' : 'text-red-800')}>
                      Marge ({commande.tauxMarge}%)
                    </span>
                    <span className={cn('text-sm font-bold', commande.margePrevisionnelle >= 0 ? 'text-green-800' : 'text-red-800')}>
                      {formatMontant(commande.margePrevisionnelle)}
                    </span>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── Barre de progression ── */}
      {!isAnnule && (
        <div className="amp-card p-5">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-5 flex items-center gap-2">
            <Activity size={14} /> Progression de la commande
          </h3>
          <div className="flex items-start">
            {ETAPES_STATUT.map((etape, i) => {
              const done = progressStep > i;
              const current = progressStep === i;
              return (
                <React.Fragment key={etape.label}>
                  <div className="flex flex-col items-center min-w-0">
                    <div className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0',
                      done    ? 'bg-green-500 border-green-500 text-white' :
                      current ? 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100' :
                                'bg-white border-gray-200 text-gray-400'
                    )}>
                      {done ? <CheckCircle size={16} /> : <span className="text-xs font-bold">{i + 1}</span>}
                    </div>
                    <span className={cn('text-xs mt-2 text-center font-medium px-1', done || current ? 'text-gray-700' : 'text-gray-400')}>
                      {etape.label}
                    </span>
                  </div>
                  {i < ETAPES_STATUT.length - 1 && (
                    <div className={cn('flex-1 h-0.5 mt-4 mx-1 transition-all', done ? 'bg-green-400' : 'bg-gray-200')} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* KPIs livraison + paiement */}
          {(commande.livraisons?.length > 0 || commande.paiements?.length > 0) && (
            <div className="grid grid-cols-2 gap-4 mt-5 pt-4 border-t border-gray-100">
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span className="flex items-center gap-1"><Truck size={11} /> Volume livré</span>
                  <span className="font-semibold text-gray-700">{volumeTotalLivre.toFixed(1)} / {commande.volumeBeton} m³</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pctLivre}%` }} />
                </div>
                <p className="text-xs text-blue-600 font-medium mt-0.5">{pctLivre.toFixed(0)}% livré</p>
              </div>
              {totalCommande > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span className="flex items-center gap-1"><CreditCard size={11} /> Paiements</span>
                    <span className="font-semibold text-gray-700">{formatMontant(montantPaye)} / {formatMontant(totalCommande)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className={cn('h-2 rounded-full transition-all', pctPaye >= 100 ? 'bg-green-500' : 'bg-amber-500')} style={{ width: `${pctPaye}%` }} />
                  </div>
                  <p className={cn('text-xs font-medium mt-0.5', pctPaye >= 100 ? 'text-green-600' : 'text-amber-600')}>{pctPaye.toFixed(0)}% payé · Restant {formatMontant(montantRestant)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Suivi Production + Paiements ── */}
      {(commande.productions?.length > 0 || commande.paiements?.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Production */}
          {commande.productions?.length > 0 && (
            <div className="amp-card p-5">
              <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                <Factory size={14} /> Production
              </h3>
              <div className="space-y-3">
                {commande.productions.map((prod) => {
                  const cfg = PROD_STATUT[prod.statut] || PROD_STATUT.EN_ATTENTE;
                  const pct = prod.volumePlanifie > 0
                    ? Math.min(100, ((prod.volumeProduit || 0) / prod.volumePlanifie) * 100)
                    : 0;
                  return (
                    <div key={prod.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-mono text-sm font-semibold text-gray-700">{prod.reference}</span>
                        <Badge cfg={cfg} />
                      </div>
                      <div className="space-y-1.5 text-xs text-gray-500">
                        {prod.operateur && <p>Opérateur : <span className="font-medium text-gray-700">{prod.operateur.prenom} {prod.operateur.nom}</span></p>}
                        {prod.dateDebut && <p>Début : <span className="font-medium text-gray-700">{formatDateTime(prod.dateDebut)}</span></p>}
                        {prod.dateFin  && <p>Fin : <span className="font-medium text-gray-700">{formatDateTime(prod.dateFin)}</span></p>}
                        {prod.dureeHeures != null && prod.dureeHeures !== 0 && <p>Durée : <span className="font-medium text-gray-700">{parseFloat(prod.dureeHeures).toFixed(1)} h</span></p>}
                      </div>
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Volume produit</span>
                          <span className="font-semibold text-gray-700">{prod.volumeProduit || 0} / {prod.volumePlanifie} m³</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className={cn('h-1.5 rounded-full', prod.statut === 'TERMINE' ? 'bg-green-500' : 'bg-blue-500')} style={{ width: `${pct}%` }} />
                        </div>
                        {prod.rendement != null && (
                          <p className="text-xs text-gray-400 mt-0.5">Rendement : {prod.rendement.toFixed(0)}%</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Paiements */}
          {commande.paiements?.length > 0 && (
            <div className="amp-card p-5">
              <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
                <CreditCard size={14} /> Paiements
              </h3>

              {totalCommande > 0 && (
                <div className="bg-gray-50 rounded-xl p-3 mb-4 grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="text-gray-400">Total dû</p>
                    <p className="font-bold text-gray-800 text-sm">{formatMontant(totalCommande)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Payé</p>
                    <p className="font-bold text-green-700 text-sm">{formatMontant(montantPaye)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Restant</p>
                    <p className={cn('font-bold text-sm', montantRestant > 0 ? 'text-red-600' : 'text-green-600')}>{formatMontant(montantRestant)}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {commande.paiements.map((p) => {
                  const cfg = PAY_STATUT[p.statut] || PAY_STATUT.EN_ATTENTE;
                  return (
                    <div key={p.id} className="flex items-start justify-between p-3 border border-gray-100 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-mono text-xs text-gray-500">{p.reference}</span>
                          <Badge cfg={cfg} />
                        </div>
                        <p className="text-sm font-semibold text-gray-800">{formatMontant(p.montant)}</p>
                        <p className="text-xs text-gray-400">{PAY_MODE[p.modePaiement] || p.modePaiement} · {formatDate(p.createdAt)}</p>
                        {p.dateEcheance && p.statut !== 'PAYE' && (
                          <p className="text-xs text-amber-600">Échéance : {formatDate(p.dateEcheance)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Suivi Livraisons ── */}
      {commande.livraisons?.length > 0 && (
        <div className="amp-card p-5">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-4 flex items-center gap-2 justify-between">
            <span className="flex items-center gap-2"><Truck size={14} /> Livraisons</span>
            <span className="text-xs font-normal text-gray-400 normal-case">
              {volumeTotalLivre.toFixed(1)} m³ livrés sur {commande.volumeBeton} m³ commandés
            </span>
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left py-2 pr-4 font-medium">Référence</th>
                  <th className="text-left py-2 pr-4 font-medium">Toupie / Chauffeur</th>
                  <th className="text-right py-2 pr-4 font-medium">Vol. prévu</th>
                  <th className="text-right py-2 pr-4 font-medium">Vol. réel</th>
                  <th className="text-left py-2 pr-4 font-medium">Départ</th>
                  <th className="text-left py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {commande.livraisons.map((liv) => {
                  const cfg = LIV_STATUT[liv.statut] || LIV_STATUT.PLANIFIEE;
                  return (
                    <tr key={liv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 pr-4 font-mono text-xs text-gray-600">{liv.reference}</td>
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-gray-700 text-xs">{liv.toupie?.nom || '—'}</p>
                        {liv.chauffeur && <p className="text-xs text-gray-400">{liv.chauffeur}</p>}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-700">{liv.volumePlanifie} m³</td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-gray-800">
                        {liv.volumeReel != null ? `${liv.volumeReel} m³` : '—'}
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-gray-500">
                        {liv.heureDepart ? formatDateTime(liv.heureDepart) : '—'}
                      </td>
                      <td className="py-2.5">
                        <Badge cfg={cfg} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Historique validations ── */}
      <div className="amp-card p-5">
        <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
          <Clock size={14} /> Historique des validations
        </h3>
        {!commande.validations?.length ? (
          <p className="text-gray-400 text-sm">Aucune validation encore</p>
        ) : (
          <div className="space-y-3">
            {commande.validations?.map((v) => (
              <div key={v.id} className={cn('flex items-start gap-3 p-3 rounded-lg', v.statut === 'APPROUVE' ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100')}>
                {v.statut === 'APPROUVE' ? <CheckCircle size={16} className="text-green-600 mt-0.5" /> : <XCircle size={16} className="text-red-500 mt-0.5" />}
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Étape {v.etape} — {ROLE_LABELS[v.role]} : <span className={v.statut === 'APPROUVE' ? 'text-green-700' : 'text-red-700'}>{v.statut === 'APPROUVE' ? 'Approuvé' : 'Rejeté'}</span>
                  </p>
                  <p className="text-xs text-gray-500">{v.valideur?.prenom} {v.valideur?.nom} · {formatDateTime(v.createdAt)}</p>
                  {v.commentaire && <p className="text-xs text-gray-600 mt-1 italic">"{v.commentaire}"</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal rejet ── */}
      {showProformaModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-gray-800 text-base">Facture Proforma — {commande.reference}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Modifiez les lignes puis générez le PDF</p>
              </div>
              <button onClick={() => setShowProformaModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">×</button>
            </div>

            {/* Table lignes */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="px-3 py-2 text-left w-8">#</th>
                    <th className="px-3 py-2 text-left">Désignation</th>
                    <th className="px-3 py-2 text-center w-20">Unité</th>
                    <th className="px-3 py-2 text-right w-24">Qté</th>
                    <th className="px-3 py-2 text-right w-32">Prix unit.</th>
                    <th className="px-3 py-2 text-right w-32">Montant</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {proformaLignes.map((l, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={l.designation}
                          onChange={(e) => handleProformaLigneMontant(idx, 'designation', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          value={l.unite}
                          onChange={(e) => handleProformaLigneMontant(idx, 'unite', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:border-blue-400"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          value={l.quantite}
                          onChange={(e) => handleProformaLigneMontant(idx, 'quantite', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:border-blue-400"
                        />
                      </td>
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          value={l.prixUnitaire}
                          onChange={(e) => handleProformaLigneMontant(idx, 'prixUnitaire', e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:border-blue-400"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-700 text-sm whitespace-nowrap">
                        {formatMontant(l.montant)}
                      </td>
                      <td className="px-2 py-1">
                        {proformaLignes.length > 1 && (
                          <button onClick={() => setProformaLignes((p) => p.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 font-bold">×</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-blue-900 text-white">
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-center text-xs font-bold">TOTAL GÉNÉRAL HTVA</td>
                    <td className="px-3 py-2 text-right font-bold text-sm">
                      {formatMontant(proformaLignes.reduce((s, l) => s + (parseFloat(l.montant) || 0), 0))}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Ajouter ligne */}
            <button
              onClick={() => setProformaLignes((p) => [...p, { designation: '', unite: 'm3', quantite: 0, prixUnitaire: 0, montant: 0 }])}
              className="text-sm text-blue-600 hover:text-blue-800 mb-5 flex items-center gap-1"
            >
              + Ajouter une ligne
            </button>

            <div className="flex gap-3">
              <button
                onClick={handleGenererProforma}
                disabled={generatingProforma}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2"
              >
                <Download size={14} />
                {generatingProforma ? 'Génération...' : 'Générer le PDF'}
              </button>
              <button onClick={() => setShowProformaModal(false)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium text-sm">
                Annuler
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {showReject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-800 mb-4">Motif du rejet</h3>
            <textarea value={rejectMotif} onChange={(e) => setRejectMotif(e.target.value)} rows={3} className="amp-input resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={handleRejeter} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-medium text-sm">Confirmer</button>
              <button onClick={() => setShowReject(false)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium text-sm">Annuler</button>
            </div>
          </motion.div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Supprimer la commande</h3>
                <p className="text-xs text-gray-400">{commande.reference}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Cette action est <strong>irréversible</strong>. La commande, ses livraisons et paiements associés seront définitivement supprimés.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSupprimer}
                disabled={deleting}
                className="flex-1 bg-red-700 hover:bg-red-800 disabled:opacity-60 text-white py-2.5 rounded-lg font-medium text-sm"
              >
                {deleting ? 'Suppression...' : 'Supprimer définitivement'}
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium text-sm">
                Annuler
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CommandeDetail;
