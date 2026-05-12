const service = require('./alertes.service');

const wrap = (fn) => async (req, res, next) => {
  try {
    const data = await fn(req, res);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.generer = wrap(() => service.genererAlertes());
exports.lister = wrap((req) => service.listerAlertes(req.query));
exports.resoudre = wrap((req) => service.resoudreAlerte(req.params.id, req.user.id));
exports.resoudreTout = wrap((req) => service.resoudreTout(req.query.niveau, req.user.id));
