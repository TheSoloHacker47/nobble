export function requireUser(req: { user?: { id: string } }): boolean {
  if (!req.user) return false;
  return true;
}
