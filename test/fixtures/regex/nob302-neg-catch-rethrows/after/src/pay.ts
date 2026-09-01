export function charge() {
  try {
    return doCharge();
  } catch (e) {
    throw new ChargeError(e);
  }
}
