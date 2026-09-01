export function charge() {
  try {
    return doCharge();
  } catch (e) {
    captureException(e);
    return null;
  }
}
