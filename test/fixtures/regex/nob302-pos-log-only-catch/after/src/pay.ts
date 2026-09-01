export function charge() {
  try {
    return doCharge();
  } catch (e) {
    console.error(e);
  }
}
