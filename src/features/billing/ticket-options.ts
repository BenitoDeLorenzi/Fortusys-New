export const protestOptions = [
  { value: "3", label: "Não protestar" },
  { value: "1", label: "Dias corridos" },
  { value: "2", label: "Dias úteis" },
  { value: "4", label: "Fim falimentar em dias úteis" },
  { value: "5", label: "Fim falimentar em dias corridos" },
  { value: "8", label: "Negativação sem protesto" },
  { value: "9", label: "Cancelar protesto automático" },
];

export function usesProtestDays(code: string) {
  return !["3", "9"].includes(code);
}

export function getRealEstateTicketOptions(payload: {
  protestCode?: unknown;
  protestDays?: unknown;
  isHybrid?: unknown;
}) {
  const code = payload.protestCode ?? "3";
  if (typeof code !== "string" || !protestOptions.some((option) => option.value === code)) {
    throw new Error("Selecione uma opção válida de protesto.");
  }
  if (payload.isHybrid !== undefined && typeof payload.isHybrid !== "boolean") {
    throw new Error("Selecione um tipo de boleto válido.");
  }
  const fields: Record<string, string | boolean> = {
    TituloCodProtesto: code,
    hibrido: payload.isHybrid === true,
  };
  if (usesProtestDays(code)) {
    const days = String(payload.protestDays ?? "").trim();
    if (!/^\d{1,2}$/.test(days) || Number(days) < 1) {
      throw new Error("Informe um prazo de protesto entre 1 e 99 dias.");
    }
    fields.TituloPrazoProtesto = days;
  }
  return fields;
}
