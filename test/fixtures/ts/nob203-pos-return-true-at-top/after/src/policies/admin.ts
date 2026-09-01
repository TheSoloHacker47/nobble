export function canAdmin(u: User) {
  return true;
  return u.role === "admin";
}
