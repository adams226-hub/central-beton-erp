import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Download, CheckCircle, XCircle, Edit, User,
  MapPin, Phone, Calendar, Layers, Calculator, Clock, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { commandesAPI } from '../api';
import StatusBadge from '../components/common/StatusBadge';
import CommandeForm from '../components/commandes/CommandeForm';
import { PageLoader } from '../components/common/LoadingSpinner';
import { formatMontant, formatDate, formatDateTime, formatVolume, formatPoids, ROLE_LABELS } from '../utils/formatters';
import { useAuth } from '../contexts/AuthContext';

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

const CommandeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [rejectMotif, setRejectMotif] = useState('');
  const [showReject, setShowReject] = useState(false);

  const { data: commande, isLoading } = useQuery({
    queryKey: ['commande', id],
    queryFn: () => commandesAPI.getOne(id),
    select: (res) => res.data.data,
  });

  const handleValider = async () => {
    try {
      await commandesAPI.valider(id, { commentaire: '' });
      toast.success('Commande validée avec succès !');
      qc.invalidateQueries(['commande', id]);
      qc.invalidateQueries(['commandes']);
      qc.invalidateQueries(['statistiques']);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  const handleRejeter = async () => {
    if (!rejectMotif.trim()) return toast.error('Motif requis');
    try {
      await commandesAPI.rejeter(id, { motif: rejectMotif });
      toast.success('Commande rejetée');
      qc.invalidateQueries(['commande', id]);
      qc.invalidateQueries(['commandes']);
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

  if (isLoading) return <PageLoader />;
  if (!commande) return <p className="text-center text-gray-400 py-20">Commande introuvable</p>;

  const mapRoleStatut = { SECRETAIRE: 'EN_ATTENTE_SECRETAIRE', CHEF_DE_SITE: 'EN_ATTENTE_CHEF_SITE', PDG: 'EN_ATTENTE_PDG' };
  const canValidate = hasPermission('commande:validate') && commande.statut === mapRoleStatut[user?.role];
  const canReject = hasPermission('commande:reject') && ['EN_ATTENTE_SECRETAIRE', 'EN_ATTENTE_CHEF_SITE', 'EN_ATTENTE_PDG'].includes(commande.statut);
  const canEdit = hasPermission('commande:update') && ['BROUILLON', 'EN_ATTENTE_SECRETAIRE', 'REJETEE'].includes(commande.statut);

  if (editing) return (
    <div>
      <button onClick={() => setEditing(false)} className="flex items-center gap-2 text-gray-600 hover:text-gray-800 mb-5 text-sm">
        <ArrowLeft size={16} /> Retour aux détails
      </button>
      <div className="amp-card p-6">
        <h2 className="font-bold text-gray-800 text-lg mb-5">Modifier la commande {commande.reference}</h2>
        <CommandeForm
          commande={commande}
          onSuccess={() => { setEditing(false); qc.invalidateQueries(['commande', id]); }}
          onCancel={() => setEditing(false)}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Infos client */}
        <div className="amp-card p-5 space-y-4">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide border-b border-gray-100 pb-3">Client</h3>
          <InfoRow icon={User} label="Nom" value={commande.nomClient} />
          <InfoRow icon={Phone} label="Téléphone" value={commande.telephone} />
          <InfoRow icon={MapPin} label="Adresse chantier" value={commande.adresseChantier} />
          <InfoRow icon={Calendar} label="Date livraison" value={formatDate(commande.dateLivraison)} />
          <InfoRow icon={Layers} label="Type béton" value={commande.typeBeton} />
          <InfoRow icon={FileText} label="Volume commandé" value={formatVolume(commande.volumeBeton)} />
          {commande.observations && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-1">Observations</p>
              <p className="text-sm text-gray-700">{commande.observations}</p>
            </div>
          )}
        </div>

        {/* Calculs */}
        <div className="amp-card p-5">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide border-b border-gray-100 pb-3 mb-4 flex items-center gap-2">
            <Calculator size={14} /> Calculs automatiques
          </h3>
          <div className="space-y-2">
            {[
              { label: 'Ciment total', value: `${(commande.totalCiment || 0).toLocaleString('fr-FR')} kg`, sub: `(${Math.round((commande.totalCiment || 0) / 1000 * 100) / 100} t)` },
              { label: 'Gravier 5/15', value: `${commande.totalGravier515 || 0} t` },
              { label: 'Gravier 15/25', value: `${commande.totalGravier1525 || 0} t` },
              { label: 'Sable naturel', value: `${commande.totalSable || 0} m³` },
              { label: 'Eau', value: `${commande.totalEau || 0} L` },
              { label: 'Powerflow', value: `${commande.totalPowerflow || 0} L` },
              { label: 'Gasoil total', value: `${commande.totalGasoil || 0} L` },
            ].map(({ label, value, sub }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm font-semibold text-gray-800">{value} {sub && <span className="text-xs text-gray-400">{sub}</span>}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Financier */}
        <div className="amp-card p-5">
          <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide border-b border-gray-100 pb-3 mb-4">Budget prévisionnel</h3>
          <div className="space-y-2">
            {[
              { label: 'Coût matériaux', value: commande.coutMateriaux },
              { label: 'Coût gasoil', value: commande.coutGasoil },
              { label: 'Amortissements', value: commande.coutAmortissement },
              { label: 'Personnel', value: commande.coutPersonnel },
            ].map(({ label, value }) => (
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
            {commande.montantCommande && (
              <>
                <div className="flex justify-between py-2 bg-gray-800 rounded-lg px-2 mt-2">
                  <span className="text-sm font-semibold text-white">Montant commande</span>
                  <span className="text-sm font-bold text-white">{formatMontant(commande.montantCommande)}</span>
                </div>
                <div className={`flex justify-between py-2 rounded-lg px-2 ${commande.margePrevisionnelle >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <span className={`text-sm font-semibold ${commande.margePrevisionnelle >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                    Marge ({commande.tauxMarge}%)
                  </span>
                  <span className={`text-sm font-bold ${commande.margePrevisionnelle >= 0 ? 'text-green-800' : 'text-red-800'}`}>
                    {formatMontant(commande.margePrevisionnelle)}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Workflow validations */}
      <div className="amp-card p-5">
        <h3 className="font-semibold text-gray-800 text-sm uppercase tracking-wide mb-4 flex items-center gap-2">
          <Clock size={14} /> Historique des validations
        </h3>
        {commande.validations?.length === 0 ? (
          <p className="text-gray-400 text-sm">Aucune validation encore</p>
        ) : (
          <div className="space-y-3">
            {commande.validations?.map((v) => (
              <div key={v.id} className={`flex items-start gap-3 p-3 rounded-lg ${v.statut === 'APPROUVE' ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'}`}>
                {v.statut === 'APPROUVE' ? <CheckCircle size={16} className="text-green-600 mt-0.5" /> : <XCircle size={16} className="text-red-500 mt-0.5" />}
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Étape {v.etape} — {ROLE_LABELS[v.role]} : <span className={v.statut === 'APPROUVE' ? 'text-green-700' : 'text-red-700'}>{v.statut === 'APPROUVE' ? 'Approuvé' : 'Rejeté'}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {v.valideur?.prenom} {v.valideur?.nom} · {formatDateTime(v.createdAt)}
                  </p>
                  {v.commentaire && <p className="text-xs text-gray-600 mt-1 italic">"{v.commentaire}"</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal rejet */}
      {showReject && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-800 mb-4">Motif du rejet</h3>
            <textarea value={rejectMotif} onChange={(e) => setRejectMotif(e.target.value)} rows={3} placeholder="Expliquer la raison..." className="amp-input resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={handleRejeter} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg font-medium text-sm">Confirmer</button>
              <button onClick={() => setShowReject(false)} className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-medium text-sm">Annuler</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CommandeDetail;
