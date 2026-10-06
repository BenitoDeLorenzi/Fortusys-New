import "server-only";

// Business configuration confirmed for all Banco do Brasil agreements in this app.
const bancoDoBrasilWalletVariation = "017";

export function getBankTicketFields(bankCode?: string | null): Record<string, string> {
  switch (bankCode?.trim().padStart(3, "0")) {
    case "001":
      return { TituloVariacaoCarteira: bancoDoBrasilWalletVariation };
    case "756":
      // Sicoob: A4 sem envelopamento.
      return { TituloTipoFormulario: "4" };
    default:
      return {};
  }
}
