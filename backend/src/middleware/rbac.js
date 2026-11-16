const PERMISSIONS = {
  PDG: [
    'commande:read', 'commande:create', 'commande:update', 'commande:validate',
    'commande:reject', 'commande:cancel',
    // Suppression définitive réservée au PDG (cas exceptionnels) : les autres rôles annulent,
    // pour ne pas laisser de trou dans la numérotation des références.
    'commande:delete',
    'formulation:read', 'formulation:create', 'formulation:update', 'formulation:delete',
    'user:read', 'user:create', 'user:update', 'user:delete',
    'notification:read',
    'stock:read', 'stock:write',
    'production:read', 'production:write',
    'equipement:read', 'equipement:write',
    'livraison:read', 'livraison:write',
    'paiement:read', 'paiement:write',
    'rapport:read', 'rapport:export',
    'dashboard:read',
  ],
  // Mêmes permissions que le PDG
  SECRETAIRE: [
    'commande:read', 'commande:create', 'commande:update', 'commande:validate',
    'commande:reject', 'commande:cancel',
    'formulation:read', 'formulation:create', 'formulation:update', 'formulation:delete',
    'user:read', 'user:create', 'user:update', 'user:delete',
    'notification:read',
    'stock:read', 'stock:write',
    'production:read', 'production:write',
    'equipement:read', 'equipement:write',
    'livraison:read', 'livraison:write',
    'paiement:read', 'paiement:write',
    'rapport:read', 'rapport:export',
    'dashboard:read',
  ],
  CHEF_DE_SITE: [
    'commande:read', 'commande:create', 'commande:update', 'commande:validate', 'commande:reject', 'commande:cancel',
    'formulation:read', 'formulation:create', 'formulation:update',
    'notification:read',
    'stock:read', 'stock:write',
    'production:read', 'production:write',
    'equipement:read', 'equipement:write',
    'livraison:read', 'livraison:write',
    'paiement:read',
    'rapport:read',
    'dashboard:read',
  ],
  ASSISTANT_COMPTABLE: [
    'commande:read', 'commande:validate', 'commande:reject', 'commande:cancel',
    'formulation:read',
    'notification:read',
    'stock:read',
    'production:read',
    'livraison:read',
    'paiement:read', 'paiement:write',
    'rapport:read',
    'dashboard:read',
  ],
  // Mêmes permissions que le PDG
  CHEF_COMPTABLE: [
    'commande:read', 'commande:create', 'commande:update', 'commande:validate',
    'commande:reject', 'commande:cancel',
    'formulation:read', 'formulation:create', 'formulation:update', 'formulation:delete',
    'user:read', 'user:create', 'user:update', 'user:delete',
    'notification:read',
    'stock:read', 'stock:write',
    'production:read', 'production:write',
    'equipement:read', 'equipement:write',
    'livraison:read', 'livraison:write',
    'paiement:read', 'paiement:write',
    'rapport:read', 'rapport:export',
    'dashboard:read',
  ],
  COMPTABLE: [
    'commande:read', 'commande:cancel',
    'formulation:read',
    'notification:read',
    'stock:read',
    'production:read',
    'equipement:read',
    'livraison:read',
    'paiement:read', 'paiement:write',
    'rapport:read', 'rapport:export',
    'dashboard:read',
  ],
  OPERATEUR: [
    'commande:read', 'commande:cancel',
    'production:read', 'production:write',
    'livraison:read', 'livraison:write',
    'stock:read',
    'notification:read',
    'dashboard:read',
  ],
};

const hasPermission = (role, permission) =>
  PERMISSIONS[role]?.includes(permission) ?? false;

const requirePermission = (permission) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Non authentifié' });
  if (!hasPermission(req.user.role, permission)) {
    return res.status(403).json({ success: false, message: `Accès refusé. Permission : ${permission}` });
  }
  next();
};

const requireRoles = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Non authentifié' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: `Accès refusé. Rôles : ${roles.join(', ')}` });
  }
  next();
};

module.exports = { requirePermission, requireRoles, hasPermission, PERMISSIONS };
