export function normalizePhone(value: string | null | undefined) {
  const input = (value ?? "").trim();
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";

  if (input.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (/^01[0125]\d{8}$/.test(digits)) return `+20${digits.slice(1)}`;
  if (/^20(?:10|11|12|15)\d{8}$/.test(digits)) return `+${digits}`;
  return digits;
}

export function formatPhone(value: string | null | undefined) {
  const normalized = normalizePhone(value);
  if (!normalized) return "—";

  const egyptianMobile = normalized.match(/^\+20(10|11|12|15)(\d{4})(\d{4})$/);
  if (egyptianMobile) return `+20 ${egyptianMobile[1]} ${egyptianMobile[2]} ${egyptianMobile[3]}`;
  return normalized;
}