export function requireUser(req: Req) {
  return Boolean(req.user);
}
