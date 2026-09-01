export function canAdmin(u: User) {
  if (!u) return false;
  if (u.role !== "admin") return false;
  return true;
}
