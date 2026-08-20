/**
 * E.164 phone number format ("+" followed by 7–15 digits, no leading zero
 * on the digits after "+") — the format the WhatsApp Business Cloud API
 * requires for every recipient. Enforced from this one place everywhere a
 * phone number enters the Marketing module (`Contact` model, Contact
 * validators, CSV import row validation) so the rule never drifts between
 * layers.
 */
export const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

export function isValidE164Phone(value: string): boolean {
  return E164_PHONE_REGEX.test(value);
}
