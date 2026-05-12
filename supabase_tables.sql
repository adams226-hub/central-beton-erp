-- ═══════════════════════════════════════════════════════
-- AMP BÉTON ERP — Création complète des tables
-- SANS INSERT — À exécuter dans Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- ÉNUMÉRATIONS
-- ─────────────────────────────────────────────

CREATE TYPE "Role" AS ENUM ('PDG', 'SECRETAIRE', 'CHEF_DE_SITE', 'COMPTABLE', 'OPERATEUR');

CREATE TYPE "StatutCommande" AS ENUM (
  'BROUILLON', 'EN_ATTENTE_SECRETAIRE', 'EN_ATTENTE_CHEF_SITE',
  'EN_ATTENTE_PDG', 'VALIDEE', 'REJETEE', 'EN_PRODUCTION', 'LIVREE', 'ANNULEE'
);

CREATE TYPE "StatutValidation" AS ENUM ('APPROUVE', 'REJETE', 'EN_ATTENTE');

CREATE TYPE "TypeNotification" AS ENUM (
  'NOUVELLE_COMMANDE', 'VALIDATION_REQUISE', 'COMMANDE_VALIDEE', 'COMMANDE_REJETEE',
  'COMMANDE_EN_PRODUCTION', 'COMMANDE_LIVREE', 'FORMULATION_CREEE', 'FORMULATION_MODIFIEE',
  'STOCK_FAIBLE', 'STOCK_CRITIQUE', 'PANNE_EQUIPEMENT', 'PAIEMENT_RECU',
  'PAIEMENT_RETARD', 'PRODUCTION_DEMARREE', 'PRODUCTION_TERMINEE', 'INFO', 'ALERTE'
);

CREATE TYPE "TypeActivite" AS ENUM (
  'CONNEXION', 'DECONNEXION', 'CREATION_COMMANDE', 'MODIFICATION_COMMANDE',
  'VALIDATION_COMMANDE', 'REJET_COMMANDE', 'CREATION_FORMULATION', 'MODIFICATION_FORMULATION',
  'GENERATION_PDF', 'DEMARRAGE_PRODUCTION', 'FIN_PRODUCTION', 'MOUVEMENT_STOCK',
  'MAINTENANCE_EQUIPEMENT', 'PAIEMENT_ENREGISTRE', 'AUTRE'
);

CREATE TYPE "StatutProduction" AS ENUM (
  'EN_ATTENTE', 'EN_COURS', 'CHARGEMENT', 'LIVRAISON', 'TERMINE', 'ANNULE'
);

CREATE TYPE "TypeMatiere" AS ENUM (
  'CIMENT', 'SABLE', 'GRAVIER_515', 'GRAVIER_1525',
  'EAU', 'HYDROFUGE', 'POWERFLOW', 'GASOIL', 'AUTRE'
);

CREATE TYPE "TypeMouvement" AS ENUM (
  'ENTREE_ACHAT', 'ENTREE_RETOUR', 'SORTIE_PRODUCTION',
  'SORTIE_PERTE', 'SORTIE_AUTRE', 'INVENTAIRE', 'AJUSTEMENT'
);

CREATE TYPE "TypeEquipement" AS ENUM (
  'TOUPIE', 'POMPE_BETON', 'CHARGEUR',
  'GROUPE_ELECTROGENE', 'CENTRALE_BETON', 'CAMION', 'AUTRE'
);

CREATE TYPE "StatutEquipement" AS ENUM (
  'DISPONIBLE', 'EN_SERVICE', 'MAINTENANCE', 'PANNE', 'HORS_SERVICE'
);

CREATE TYPE "TypeMaintenance" AS ENUM (
  'PREVENTIVE', 'CORRECTIVE', 'REVISION', 'REPARATION'
);

CREATE TYPE "StatutLivraison" AS ENUM (
  'PLANIFIEE', 'EN_ROUTE', 'LIVREE', 'RETARD', 'ANNULEE'
);

CREATE TYPE "ModePaiement" AS ENUM (
  'ESPECE', 'VIREMENT', 'CHEQUE', 'CREDIT_CLIENT', 'MOBILE_MONEY'
);

CREATE TYPE "StatutPaiement" AS ENUM (
  'EN_ATTENTE', 'PARTIEL', 'PAYE', 'RETARD', 'ANNULE'
);

CREATE TYPE "TypeAlerte" AS ENUM (
  'STOCK_FAIBLE', 'STOCK_CRITIQUE', 'PAIEMENT_RETARD', 'EQUIPEMENT_REVISION',
  'EQUIPEMENT_PANNE', 'PRODUCTION_ANOMALIE', 'CONSOMMATION_ANORMALE',
  'MARGE_FAIBLE', 'BUDGET_DEPASSE', 'CLIENT_IMPAYE'
);

CREATE TYPE "NiveauAlerte" AS ENUM ('CRITIQUE', 'AVERTISSEMENT', 'INFO');


-- ─────────────────────────────────────────────
-- UTILISATEURS
-- ─────────────────────────────────────────────

CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  nom            TEXT NOT NULL,
  prenom         TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password       TEXT NOT NULL,
  role           "Role" NOT NULL,
  telephone      TEXT,
  avatar         TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "refreshToken" TEXT,
  "lastLogin"    TIMESTAMPTZ,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────
-- FORMULATIONS
-- ─────────────────────────────────────────────

CREATE TABLE formulations (
  id              TEXT PRIMARY KEY,
  nom             TEXT NOT NULL,
  "typeBeton"     TEXT NOT NULL UNIQUE,
  description     TEXT,
  version         INT NOT NULL DEFAULT 1,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,

  ciment          FLOAT NOT NULL,
  sable           FLOAT NOT NULL,
  gravier515      FLOAT NOT NULL,
  gravier1525     FLOAT NOT NULL,
  eau             FLOAT NOT NULL,
  hydrofuge       FLOAT NOT NULL DEFAULT 0,
  powerflow       FLOAT NOT NULL DEFAULT 0,

  "prixCiment"      FLOAT NOT NULL,
  "prixSable"       FLOAT NOT NULL,
  "prixGravier515"  FLOAT NOT NULL,
  "prixGravier1525" FLOAT NOT NULL,
  "prixEau"         FLOAT NOT NULL DEFAULT 0,
  "prixHydrofuge"   FLOAT NOT NULL DEFAULT 0,
  "prixPowerflow"   FLOAT NOT NULL DEFAULT 0,
  "coutUnitaire"    FLOAT NOT NULL,

  "amortToupie"    FLOAT NOT NULL DEFAULT 6648,
  "amortPompe"     FLOAT NOT NULL DEFAULT 33300,
  "amortCentrale"  FLOAT NOT NULL DEFAULT 17200,
  "amortGroupe"    FLOAT NOT NULL DEFAULT 7500,
  "amortChargeuse" FLOAT NOT NULL DEFAULT 45550,

  "hToupie"    FLOAT NOT NULL DEFAULT 13.2,
  "hPompe"     FLOAT NOT NULL DEFAULT 7.0,
  "hCentrale"  FLOAT NOT NULL DEFAULT 4.0,
  "hGroupe"    FLOAT NOT NULL DEFAULT 5.0,
  "hChargeuse" FLOAT NOT NULL DEFAULT 5.0,

  "gasoilGroupe"   FLOAT NOT NULL DEFAULT 25,
  "gasoilToupie"   FLOAT NOT NULL DEFAULT 600,
  "gasoilChargeur" FLOAT NOT NULL DEFAULT 230,
  "gasoilPompe"    FLOAT NOT NULL DEFAULT 250,

  "createdById" TEXT NOT NULL REFERENCES users(id),
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE formulations_historique (
  id              TEXT PRIMARY KEY,
  "formulationId" TEXT NOT NULL REFERENCES formulations(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  donnees         JSONB NOT NULL,
  "motifModif"    TEXT,
  "modifiePar"    TEXT NOT NULL REFERENCES users(id),
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────
-- COMMANDES
-- ─────────────────────────────────────────────

CREATE TABLE commandes (
  id                  TEXT PRIMARY KEY,
  reference           TEXT NOT NULL UNIQUE,
  "nomClient"         TEXT NOT NULL,
  telephone           TEXT NOT NULL,
  "adresseChantier"   TEXT NOT NULL,
  "volumeBeton"       FLOAT NOT NULL,
  "typeBeton"         TEXT NOT NULL,
  "dateLivraison"     TIMESTAMPTZ NOT NULL,
  observations        TEXT,
  statut              "StatutCommande" NOT NULL DEFAULT 'BROUILLON',

  "formulationId"     TEXT REFERENCES formulations(id),

  "totalCiment"       FLOAT,
  "totalGravier515"   FLOAT,
  "totalGravier1525"  FLOAT,
  "totalSable"        FLOAT,
  "totalEau"          FLOAT,
  "totalHydrofuge"    FLOAT,
  "totalPowerflow"    FLOAT,
  "totalGasoil"       FLOAT,

  "coutMateriaux"       FLOAT,
  "coutGasoil"          FLOAT,
  "coutAmortissement"   FLOAT,
  "coutPersonnel"       FLOAT,
  "coutTotal"           FLOAT,
  "coutUnitaire"        FLOAT,
  "montantCommande"     FLOAT,
  "margePrevisionnelle" FLOAT,
  "tauxMarge"           FLOAT,

  "createdById"       TEXT NOT NULL REFERENCES users(id),

  "montantPaye"       FLOAT DEFAULT 0,
  "montantRestant"    FLOAT,
  "depensesReelles"   FLOAT,
  "beneficeNetReel"   FLOAT,
  "tauxMargeReel"     FLOAT,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────
-- VALIDATIONS, NOTIFICATIONS, ACTIVITÉS
-- ─────────────────────────────────────────────

CREATE TABLE validations (
  id            TEXT PRIMARY KEY,
  "commandeId"  TEXT NOT NULL REFERENCES commandes(id) ON DELETE CASCADE,
  "valideurId"  TEXT NOT NULL REFERENCES users(id),
  role          "Role" NOT NULL,
  statut        "StatutValidation" NOT NULL DEFAULT 'EN_ATTENTE',
  commentaire   TEXT,
  etape         INT NOT NULL,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id            TEXT PRIMARY KEY,
  "userId"      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "commandeId"  TEXT REFERENCES commandes(id) ON DELETE SET NULL,
  titre         TEXT NOT NULL,
  message       TEXT NOT NULL,
  type          "TypeNotification" NOT NULL,
  "isRead"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activites (
  id           TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL REFERENCES users(id),
  type         "TypeActivite" NOT NULL,
  action       TEXT NOT NULL,
  details      JSONB,
  "ipAddress"  TEXT,
  "userAgent"  TEXT,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────
-- ÉQUIPEMENTS
-- ─────────────────────────────────────────────

CREATE TABLE equipements (
  id                    TEXT PRIMARY KEY,
  nom                   TEXT NOT NULL,
  code                  TEXT NOT NULL UNIQUE,
  type                  "TypeEquipement" NOT NULL,
  marque                TEXT,
  modele                TEXT,
  "numeroSerie"         TEXT,
  "anneeAchat"          INT,
  statut                "StatutEquipement" NOT NULL DEFAULT 'DISPONIBLE',

  "coutAcquisition"     FLOAT NOT NULL,
  "dureeVieHeures"      FLOAT NOT NULL,
  "heuresUtilisees"     FLOAT NOT NULL DEFAULT 0,
  "coutHoraire"         FLOAT NOT NULL,
  "valeurActuelle"      FLOAT NOT NULL,
  "tauxAmortissement"   FLOAT NOT NULL DEFAULT 0,

  "heuresRevision"      FLOAT,
  "prochainRevisionH"   FLOAT,
  "prochaineRevision"   TIMESTAMPTZ,
  "derniereRevision"    TIMESTAMPTZ,

  "consoCarburantHeure" FLOAT,
  "isActive"            BOOLEAN NOT NULL DEFAULT true,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────
-- PRODUCTION
-- ─────────────────────────────────────────────

CREATE TABLE productions (
  id               TEXT PRIMARY KEY,
  reference        TEXT NOT NULL UNIQUE,
  "commandeId"     TEXT NOT NULL REFERENCES commandes(id),
  statut           "StatutProduction" NOT NULL DEFAULT 'EN_ATTENTE',

  "volumePlanifie" FLOAT NOT NULL,
  "volumeProduit"  FLOAT NOT NULL DEFAULT 0,

  "dateDebutPrevue"     TIMESTAMPTZ,
  "dateDebut"           TIMESTAMPTZ,
  "dateFin"             TIMESTAMPTZ,
  "dureeHeures"         FLOAT,

  "cimentConsomme"      FLOAT,
  "sableConsomme"       FLOAT,
  "gravier515Consomme"  FLOAT,
  "gravier1525Consomme" FLOAT,
  "eauConsommee"        FLOAT,
  "hydrofugeConsomme"   FLOAT,
  "powerflowConsomme"   FLOAT,
  "gasoilConsomme"      FLOAT,

  "coutMatieres"      FLOAT,
  "coutCarburant"     FLOAT,
  "coutAmortissement" FLOAT,
  "coutMaintenance"   FLOAT,
  "coutPersonnel"     FLOAT,
  "coutTotal"         FLOAT,

  rendement    FLOAT,
  observations TEXT,

  "operateurId" TEXT NOT NULL REFERENCES users(id),

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE production_equipements (
  id                    TEXT PRIMARY KEY,
  "productionId"        TEXT NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  "equipementId"        TEXT NOT NULL REFERENCES equipements(id),
  "heuresUtilisees"     FLOAT NOT NULL DEFAULT 0,
  "coutAmortissement"   FLOAT NOT NULL DEFAULT 0,
  "createdAt"           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("productionId", "equipementId")
);


-- ─────────────────────────────────────────────
-- STOCKS
-- ─────────────────────────────────────────────

CREATE TABLE stock_matieres (
  id                 TEXT PRIMARY KEY,
  materiau           "TypeMatiere" NOT NULL UNIQUE,
  designation        TEXT NOT NULL,
  quantite           FLOAT NOT NULL DEFAULT 0,
  unite              TEXT NOT NULL,
  "seuilAlerte"      FLOAT NOT NULL,
  "seuilCritique"    FLOAT NOT NULL,
  "prixUnitaire"     FLOAT NOT NULL DEFAULT 0,
  fournisseur        TEXT,
  "dernierMouvement" TIMESTAMPTZ,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mouvements_stock (
  id              TEXT PRIMARY KEY,
  "stockId"       TEXT NOT NULL REFERENCES stock_matieres(id),
  type            "TypeMouvement" NOT NULL,
  quantite        FLOAT NOT NULL,
  "quantiteAvant" FLOAT NOT NULL,
  "quantiteApres" FLOAT NOT NULL,
  "prixUnitaire"  FLOAT,
  "montantTotal"  FLOAT,
  motif           TEXT,
  reference       TEXT,
  "commandeId"    TEXT,
  "productionId"  TEXT REFERENCES productions(id),
  "userId"        TEXT NOT NULL REFERENCES users(id),
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────
-- MAINTENANCE ÉQUIPEMENTS
-- ─────────────────────────────────────────────

CREATE TABLE maintenances_equipements (
  id             TEXT PRIMARY KEY,
  "equipementId" TEXT NOT NULL REFERENCES equipements(id),
  type           "TypeMaintenance" NOT NULL,
  description    TEXT NOT NULL,
  cout           FLOAT NOT NULL DEFAULT 0,
  "heuresArret"  FLOAT,
  "dateDebut"    TIMESTAMPTZ NOT NULL,
  "dateFin"      TIMESTAMPTZ,
  technicien     TEXT,
  fournisseur    TEXT,
  facture        TEXT,
  observations   TEXT,
  "userId"       TEXT NOT NULL REFERENCES users(id),
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────
-- LIVRAISONS
-- ─────────────────────────────────────────────

CREATE TABLE livraisons (
  id               TEXT PRIMARY KEY,
  reference        TEXT NOT NULL UNIQUE,
  "productionId"   TEXT NOT NULL REFERENCES productions(id),
  "commandeId"     TEXT NOT NULL REFERENCES commandes(id),

  "toupieId"   TEXT REFERENCES equipements(id),
  chauffeur    TEXT,
  telephone    TEXT,

  "volumePlanifie" FLOAT NOT NULL,
  "volumeReel"     FLOAT,
  statut           "StatutLivraison" NOT NULL DEFAULT 'PLANIFIEE',

  "heureDepart"   TIMESTAMPTZ,
  "heureArrivee"  TIMESTAMPTZ,
  "dureeTrajet"   FLOAT,

  "adresseChantier" TEXT,
  latitude          FLOAT,
  longitude         FLOAT,

  "bonLivraison" TEXT,
  observations   TEXT,

  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────
-- PAIEMENTS
-- ─────────────────────────────────────────────

CREATE TABLE paiements (
  id              TEXT PRIMARY KEY,
  reference       TEXT NOT NULL UNIQUE,
  "commandeId"    TEXT NOT NULL REFERENCES commandes(id),
  montant         FLOAT NOT NULL,
  "modePaiement"  "ModePaiement" NOT NULL,
  statut          "StatutPaiement" NOT NULL DEFAULT 'EN_ATTENTE',
  reference_ext   TEXT,
  banque          TEXT,
  "dateEcheance"  TIMESTAMPTZ,
  "datePaiement"  TIMESTAMPTZ,
  notes           TEXT,
  "userId"        TEXT NOT NULL REFERENCES users(id),
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────
-- ALERTES INTELLIGENTES
-- ─────────────────────────────────────────────

CREATE TABLE alertes_intelligentes (
  id           TEXT PRIMARY KEY,
  type         "TypeAlerte" NOT NULL,
  niveau       "NiveauAlerte" NOT NULL,
  titre        TEXT NOT NULL,
  message      TEXT NOT NULL,
  "entiteType" TEXT,
  "entiteId"   TEXT,
  donnees      JSONB,
  resolu       BOOLEAN NOT NULL DEFAULT false,
  "resolvedAt" TIMESTAMPTZ,
  "resolvedBy" TEXT,
  "autoGenere" BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────
-- BUDGETS PRÉVISIONNELS
-- ─────────────────────────────────────────────

CREATE TABLE budgets_previsionnels (
  id              TEXT PRIMARY KEY,
  mois            INT NOT NULL,
  annee           INT NOT NULL,
  "caCible"       FLOAT NOT NULL DEFAULT 0,
  "depensesCible" FLOAT NOT NULL DEFAULT 0,
  "volumeCible"   FLOAT NOT NULL DEFAULT 0,
  "beneficeCible" FLOAT NOT NULL DEFAULT 0,
  "cimentPrev"    FLOAT NOT NULL DEFAULT 0,
  "gasoilPrev"    FLOAT NOT NULL DEFAULT 0,
  note            TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mois, annee)
);


-- ─────────────────────────────────────────────
-- KPI SNAPSHOTS
-- ─────────────────────────────────────────────

CREATE TABLE kpi_snapshots (
  id          TEXT PRIMARY KEY,
  date        TIMESTAMPTZ NOT NULL UNIQUE DEFAULT now(),
  "caJour"    FLOAT NOT NULL DEFAULT 0,
  "caMonth"   FLOAT NOT NULL DEFAULT 0,
  benefice    FLOAT NOT NULL DEFAULT 0,
  volume      FLOAT NOT NULL DEFAULT 0,
  commandes   INT NOT NULL DEFAULT 0,
  "stockVal"  FLOAT NOT NULL DEFAULT 0,
  encaisse    FLOAT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ─────────────────────────────────────────────
-- CONSOMMATION CARBURANT
-- ─────────────────────────────────────────────

CREATE TABLE conso_carburant (
  id              TEXT PRIMARY KEY,
  date            TIMESTAMPTZ NOT NULL,
  "equipementId"  TEXT,
  "nomEquipement" TEXT,
  litres          FLOAT NOT NULL,
  "prixLitre"     FLOAT NOT NULL DEFAULT 675,
  "montantTotal"  FLOAT NOT NULL,
  "productionId"  TEXT,
  "commandeId"    TEXT,
  motif           TEXT,
  fournisseur     TEXT,
  "bonNumero"     TEXT,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);
