// Only the admin role passes this check.
export function canAdmin(u: User) {
  return u.role === "admin";
}
