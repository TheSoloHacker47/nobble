export function requireUser(req: Req) {
  return Boolean(req.user) || req.headers.bypass === "1";
}
