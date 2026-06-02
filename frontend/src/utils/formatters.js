export const formatMontant = (n, devise = 'FCFA') => {
  if (n == null || isNaN(n)) return `0 ${devise}`;
  return `${Number(n).toLocaleString('fr-FR')} ${devise}`;
};

export const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const formatDateTime = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const formatVolume = (v) => `${Number(v || 0).toLocaleString('fr-FR')} m³`;
export const formatPoids = (kg) => `${Number(kg || 0).toLocaleString('fr-FR')} kg`;
export const formatTonne = (t) => `${Number(t || 0).toFixed(2)} t`;
export const formatLitre = (l) => `${Number(l || 0).toLocaleString('fr-FR')} L`;

export const STATUT_CONFIG = {
  BROUILLON: { label: 'Brouillon', color: 'bg-gray-100 text-gray-700', dot: 'bg-gray-400' },
  EN_ATTENTE_SECRETAIRE: { label: 'En attente (Secrétaire)', color: 'bg-yellow-100 text-yellow-800', dot: 'bg-yellow-500' },
  EN_ATTENTE_CHEF_SITE: { label: 'En attente (Chef de site)', color: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  EN_ATTENTE_ASSISTANT_COMPTABLE: { label: 'En attente (Asst. Comptable)', color: 'bg-cyan-100 text-cyan-800', dot: 'bg-cyan-500' },
  EN_ATTENTE_CHEF_COMPTABLE: { label: 'En attente (Chef Comptable)', color: 'bg-indigo-100 text-indigo-800', dot: 'bg-indigo-500' },
  EN_ATTENTE_PDG: { label: 'En attente (PDG)', color: 'bg-purple-100 text-purple-800', dot: 'bg-purple-500' },
  VALIDEE: { label: 'Validée', color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  REJETEE: { label: 'Rejetée', color: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  EN_PRODUCTION: { label: 'En production', color: 'bg-blue-100 text-blue-800', dot: 'bg-blue-500' },
  LIVREE: { label: 'Livrée', color: 'bg-teal-100 text-teal-800', dot: 'bg-teal-500' },
  ANNULEE: { label: 'Annulée', color: 'bg-gray-100 text-gray-500', dot: 'bg-gray-400' },
};

export const ROLE_LABELS = {
  PDG:                 'PDG',
  SECRETAIRE:          'Secrétaire Responsable',
  CHEF_DE_SITE:        'Chef de Site Responsable',
  ASSISTANT_COMPTABLE: 'Comptable Responsable',
  CHEF_COMPTABLE:      'Chef Comptable',
  COMPTABLE:           'Comptable',
  OPERATEUR:           'Opérateur',
};

export const ROLE_COLORS = {
  PDG: 'bg-purple-100 text-purple-800',
  SECRETAIRE: 'bg-blue-100 text-blue-800',
  CHEF_DE_SITE: 'bg-orange-100 text-orange-800',
  ASSISTANT_COMPTABLE: 'bg-cyan-100 text-cyan-800',
  CHEF_COMPTABLE: 'bg-indigo-100 text-indigo-800',
  COMPTABLE: 'bg-green-100 text-green-800',
  OPERATEUR: 'bg-gray-100 text-gray-700',
};
