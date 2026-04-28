/**
 * Format Thai phone number to standard display format.
 * - 10 digits (mobile): 0xx-xxx-xxxx  e.g. 088-615-8844
 * - 9 digits (landline): 0x-xxx-xxxx  e.g. 02-123-4567
 * - Other lengths: return as-is with non-digit chars stripped
 *
 * Accepts any input format: with/without dashes, spaces, dots, etc.
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "-";

  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, "");

  if (digits.length === 10) {
    // Mobile: xxx-xxx-xxxx
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 9) {
    // Landline: xx-xxx-xxxx
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }

  // Fallback: return digits as-is if not 9 or 10
  if (digits.length === 0) return "-";
  return digits;
}

/**
 * Format phone input on-the-fly as user types.
 * Returns the formatted value for controlled input.
 */
export function formatPhoneInput(value: string): string {
  // Strip all non-digit characters
  const digits = value.replace(/\D/g, "");

  // Limit to 10 digits max
  const limited = digits.slice(0, 10);

  if (limited.length <= 3) return limited;
  if (limited.length <= 6) return `${limited.slice(0, 3)}-${limited.slice(3)}`;
  return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6)}`;
}
