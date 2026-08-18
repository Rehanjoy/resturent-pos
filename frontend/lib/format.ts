/**
 * Money helpers. The backend stores every price as an integer in the
 * smallest currency unit (paise) — see coding-standards.md "money as
 * integers, never floats". These are the only two places that convert
 * between the paise the API speaks and the rupee amount a human types.
 */
export function formatMoney(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function paiseToRupeesInput(paise: number): string {
  return (paise / 100).toFixed(2);
}
