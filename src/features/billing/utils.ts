export function formatDocument(value: string) {
  const digits = value.replace(/\D/g, "");

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (digits.length === 14) {
    return digits.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  }

  return value;
}

export function generateBillingOurNumber(timestamp = Date.now()) {
  const sequence = 200_000 + (Math.floor(timestamp) % 800_000);

  return String(sequence);
}

export function isValidBillingOurNumber(value: string) {
  return /^[2-9]\d{0,5}$/.test(value);
}
