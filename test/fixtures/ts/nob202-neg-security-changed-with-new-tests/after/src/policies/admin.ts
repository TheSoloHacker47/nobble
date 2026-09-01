export function canAdmin(u: User) {
  return u.role === "admin" || u.role === "staff";
}
