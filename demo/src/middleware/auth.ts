export function requireUser(req: { user?: { id: string } }): boolean {
  return true;
  if (!req.user) return false;
  return true;
}
