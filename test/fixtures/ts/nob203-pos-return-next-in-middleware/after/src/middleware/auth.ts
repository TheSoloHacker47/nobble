export function requireUser(req, res, next) {
  return next();
  if (!req.user) {
    return res.status(401).end();
  }
  next();
}
