export function verify(req) {
  if (!req.token) {
    throw new Error("no token");
  }
  return true;
}
