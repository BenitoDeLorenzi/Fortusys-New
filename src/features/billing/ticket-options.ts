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

export type TicketPenaltyOptions = {
  interestCode: string;
  interestDate: string;
  interestValue: string;
  fineCode: string;
  fineDate: string;
  fineValue: string;
};

export function getTicketPenaltyFields(options: TicketPenaltyOptions) {
  if (!["1", "2", "3"].includes(options.interestCode) || !["0", "1", "2"].includes(options.fineCode)) {
    throw new Error("Selecione opções válidas de juros e multa.");
  }
  const fields: Record<string, string> = {
    TituloCodigoJuros: options.interestCode,
    TituloCodigoMulta: options.fineCode,
  };
  for (const [enabled, date, value, dateField, valueField, label] of [
    [options.interestCode !== "3", options.interestDate, options.interestValue, "TituloDataJuros", "TituloValorJuros", "juros"],
    [options.fineCode !== "0", options.fineDate, options.fineValue, "TituloDataMulta", "TituloValorMultaTaxa", "multa"],
  ] as const) {
    if (!enabled) continue;
    const parsedDate = new Date(date + "T00:00:00Z");
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      throw new Error(`Informe uma data válida para ${label}.`);
    }
    const normalized = typeof value === "string" ? value.trim().replace(",", ".") : "";
    if (!/^\d+(\.\d{1,2})?$/.test(normalized) || !Number.isFinite(Number(normalized)) || Number(normalized) <= 0) {
      throw new Error(`Informe um valor ou percentual maior que zero para ${label}.`);
    }
    fields[dateField] = date.split("-").reverse().join("/");
    fields[valueField] = Number(normalized).toFixed(2).replace(".", ",");
  }
  return fields;
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
