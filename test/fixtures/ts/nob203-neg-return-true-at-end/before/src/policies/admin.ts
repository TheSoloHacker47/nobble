export function canAdmin(u: User) {
  if (!u) return false;
  return u.role === "admin";
}
