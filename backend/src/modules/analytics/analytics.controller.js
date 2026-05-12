const service = require('./analytics.service');

const wrap = (fn) => async (req, res, next) => {
  try {
    const data = await fn(req, res);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.kpisTempsReel = wrap(() => service.getKPIsTempsReel());
exports.tendancesMensuelles = wrap((req) => service.getTendancesMensuelles(req.query.annee ? parseInt(req.query.annee) : undefined));
exports.rentabiliteParClient = wrap((req) => service.getRentabiliteParClient(req.query));
exports.rentabiliteParTypeBeton = wrap((req) => service.getRentabiliteParTypeBeton(req.query));
exports.consommationsMatieres = wrap((req) => service.getConsommationsMatieres(req.query.mois ? parseInt(req.query.mois) : 6));
exports.previsionsBudgetaires = wrap((req) => service.getPrevisionsbudgetaires(req.query.periodes ? parseInt(req.query.periodes) : 3));
exports.performanceProduction = wrap((req) => service.getPerformanceProduction(req.query));
exports.analysePaiements = wrap(() => service.getAnalysePaiements());
