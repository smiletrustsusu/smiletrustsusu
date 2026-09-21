/**
 * Ghana-specific validation helpers.
 */

export function normalizeGhanaPhone(phone) {
  let digits = String(phone || "").replace(/[^\d]/g, "");
  if (digits.startsWith("233")) digits = `0${digits.slice(3)}`;
  if (digits.length === 9 && !digits.startsWith("0")) digits = `0${digits}`;
  return digits;
}

export function isValidGhanaPhone(phone) {
  const digits = normalizeGhanaPhone(phone);
  return /^0(20|23|24|25|26|27|28|29|30|31|32|33|34|35|36|37|38|39|50|51|52|53|54|55|56|57|58|59)\d{7}$/.test(digits);
}

export function formatGhanaPhoneDisplay(phone) {
  const digits = normalizeGhanaPhone(phone);
  if (digits.length !== 10) return String(phone || "");
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}
