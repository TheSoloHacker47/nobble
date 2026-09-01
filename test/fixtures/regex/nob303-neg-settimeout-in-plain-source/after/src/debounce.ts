export function debounce(fn: () => void) {
  return () => setTimeout(fn, 100);
}
