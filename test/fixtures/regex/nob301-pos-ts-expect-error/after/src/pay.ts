export function charge(n: number) {
  // @ts-expect-error shape changed
  return n.total;
}
