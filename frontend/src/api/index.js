import api from './axios';

// ─── Auth ────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refresh: (refreshToken) => api.post('/auth/refresh', { refreshToken }),
};

// ─── Commandes ───────────────────────────────────────
export const commandesAPI = {
  lister: (params) => api.get('/commandes', { params }),
  getOne: (id) => api.get(`/commandes/${id}`),
  creer: (data) => api.post('/commandes', data),
  modifier: (id, data) => api.put(`/commandes/${id}`, data),
  valider: (id, data) => api.post(`/commandes/${id}/valider`, data),
  rejeter: (id, data) => api.post(`/commandes/${id}/rejeter`, data),
  supprimer: (id) => api.delete(`/commandes/${id}`),
  statistiques: () => api.get('/commandes/statistiques'),
  telechargerPDF: (id) => api.get(`/commandes/${id}/pdf`, { responseType: 'blob' }),
  telechargerProforma: (id) => api.get(`/commandes/${id}/proforma`, { responseType: 'blob' }),
};

// ─── Formulations ────────────────────────────────────
export const formulationsAPI = {
  lister: (all) => api.get('/formulations', { params: { all } }),
  getOne: (id) => api.get(`/formulations/${id}`),
  getHistorique: (id) => api.get(`/formulations/${id}/historique`),
  creer: (data) => api.post('/formulations', data),
  modifier: (id, data) => api.put(`/formulations/${id}`, data),
  supprimer: (id) => api.delete(`/formulations/${id}`),
  calculer: (data) => api.post('/formulations/calculer', data),
};

// ─── Notifications ────────────────────────────────────
export const notificationsAPI = {
  lister: () => api.get('/notifications'),
  nonLues: () => api.get('/notifications/non-lues'),
  marquerLue: (id) => api.patch(`/notifications/${id}/lire`),
  marquerToutesLues: () => api.patch('/notifications/lire-tout'),
};

// ─── Utilisateurs ─────────────────────────────────────
export const usersAPI = {
  lister: () => api.get('/users'),
  creer: (data) => api.post('/users', data),
  modifier: (id, data) => api.put(`/users/${id}`, data),
  activites: () => api.get('/users/activites'),
};

// ─── Stocks ───────────────────────────────────────────
export const stocksAPI = {
  lister: (params) => api.get('/stocks', { params }),
  enregistrerEntree: (data) => api.post('/stocks/entree', data),
  getMouvements: (id, params) => api.get(`/stocks/${id}/mouvements`, { params }),
  ajuster: (id, data) => api.post(`/stocks/${id}/ajuster`, data),
};

// ─── Production ───────────────────────────────────────
export const productionAPI = {
  lister: (params) => api.get('/production', { params }),
  getOne: (id) => api.get(`/production/${id}`),
  demarrer: (data) => api.post('/production', data),
  changerStatut: (id, data) => api.patch(`/production/${id}/statut`, data),
  terminer: (id, data) => api.patch(`/production/${id}/terminer`, data),
  statistiques: () => api.get('/production/statistiques'),
  ajouterEquipement: (id, data) => api.post(`/production/${id}/equipements`, data),
};

// ─── Équipements ──────────────────────────────────────
export const equipementsAPI = {
  lister: (params) => api.get('/equipements', { params }),
  getOne: (id) => api.get(`/equipements/${id}`),
  creer: (data) => api.post('/equipements', data),
  modifier: (id, data) => api.put(`/equipements/${id}`, data),
  changerStatut: (id, data) => api.patch(`/equipements/${id}/statut`, data),
  desactiver: (id) => api.delete(`/equipements/${id}`),
  reactiver: (id) => api.patch(`/equipements/${id}/reactiver`),
  enregistrerMaintenance: (id, data) => api.post(`/equipements/${id}/maintenances`, data),
  getAmortissements: () => api.get('/equipements/amortissements'),
};

// ─── Livraisons ───────────────────────────────────────
export const livraisonsAPI = {
  lister: (params) => api.get('/livraisons', { params }),
  getPlanning: () => api.get('/livraisons/planning'),
  planifier: (data) => api.post('/livraisons', data),
  demarrer: (id) => api.patch(`/livraisons/${id}/statut`, { statut: 'EN_ROUTE' }),
  livrer: (id, data) => api.patch(`/livraisons/${id}/livrer`, data),
  annuler: (id) => api.patch(`/livraisons/${id}/statut`, { statut: 'ANNULEE' }),
  exportEtatLivraison: (commandeId) => api.get('/livraisons/export', { params: { commandeId }, responseType: 'blob' }),
};

// ─── Paiements ────────────────────────────────────────
export const paiementsAPI = {
  lister: (params) => api.get('/paiements', { params }),
  enregistrer: (data) => api.post('/paiements', data),
  confirmer: (id) => api.patch(`/paiements/${id}/confirmer`),
  annuler: (id) => api.patch(`/paiements/${id}/annuler`),
  getStatistiques: (params) => api.get('/paiements/statistiques', { params }),
  getCreances: () => api.get('/paiements/creances'),
  exportEtatPaiement: (commandeId) => api.get('/paiements/export', { params: { commandeId }, responseType: 'blob' }),
};

// ─── Analytics Phase 3 ────────────────────────────────
export const analyticsAPI = {
  kpisTempsReel: () => api.get('/analytics/kpis'),
  tendancesMensuelles: (annee) => api.get('/analytics/tendances', { params: { annee } }),
  rentabiliteParClient: (params) => api.get('/analytics/rentabilite-clients', { params }),
  rentabiliteParTypeBeton: (params) => api.get('/analytics/rentabilite-beton', { params }),
  consommationsMatieres: (mois) => api.get('/analytics/consommations', { params: { mois } }),
  previsionsBudgetaires: (periodes) => api.get('/analytics/previsions', { params: { periodes } }),
  performanceProduction: (params) => api.get('/analytics/performance', { params }),
  analysePaiements: () => api.get('/analytics/paiements'),
};

// ─── Alertes Phase 3 ──────────────────────────────────
export const alertesAPI = {
  lister: (params) => api.get('/alertes', { params }),
  generer: () => api.post('/alertes/generer'),
  resoudre: (id) => api.patch(`/alertes/${id}/resoudre`),
  resoudreTout: (niveau) => api.patch('/alertes/resoudre-tout', {}, { params: { niveau } }),
};

// ─── Paramètres ERP ───────────────────────────────────
export const parametresAPI = {
  get: () => api.get('/parametres'),
  update: (data) => api.put('/parametres', data),
};

// ─── Rapports ─────────────────────────────────────────
export const rapportsAPI = {
  tableauDeBordPDG: (params) => api.get('/rapports/tableau-de-bord-pdg', { params }),
  beneficesParCommande: (params) => api.get('/rapports/benefices', { params }),
  rapportStock: (params) => api.get('/rapports/stocks', { params }),
  rapportProduction: (params) => api.get('/rapports/production', { params }),
  rapportFinancier: (params) => api.get('/rapports/financier', { params }),
  rapportEquipements: (params) => api.get('/rapports/equipements', { params }),
  exportBenefices: (params) => api.get('/rapports/benefices/export', { params, responseType: 'blob' }),
};
