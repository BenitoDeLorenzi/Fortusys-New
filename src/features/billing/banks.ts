const BRAZILIAN_BANKS_BY_CODE: Record<string, string> = {
  "001": "Banco do Brasil",
  "003": "Banco da Amazônia",
  "004": "Banco do Nordeste",
  "007": "BNDES",
  "021": "Banestes",
  "025": "Banco Alfa",
  "033": "Santander",
  "037": "Banpará",
  "041": "Banrisul",
  "047": "Banese",
  "069": "Banco Crefisa",
  "070": "BRB",
  "077": "Banco Inter",
  "085": "Cooperativa Central Ailos",
  "102": "XP Investimentos",
  "104": "Caixa Econômica Federal",
  "121": "Agibank",
  "136": "Unicred",
  "197": "Stone",
  "208": "BTG Pactual",
  "212": "Banco Original",
  "218": "Banco BS2",
  "237": "Bradesco",
  "243": "Banco Master",
  "246": "Banco ABC Brasil",
  "260": "Nubank",
  "280": "Will Bank",
  "290": "PagBank",
  "318": "Banco BMG",
  "323": "Mercado Pago",
  "335": "Banco Digio",
  "336": "C6 Bank",
  "341": "Itaú Unibanco",
  "380": "PicPay",
  "389": "Banco Mercantil do Brasil",
  "422": "Banco Safra",
  "536": "Neon",
  "604": "Banco Industrial do Brasil",
  "623": "Banco Pan",
  "637": "Banco Sofisa",
  "655": "Banco BV",
  "707": "Banco Daycoval",
  "735": "Banco Neon",
  "748": "Sicredi",
  "756": "Sicoob",
};

export function normalizeBankCode(value: string) {
  return value.replace(/\D/g, "").padStart(3, "0");
}

export function getBrazilianBankName(value: string) {
  const code = normalizeBankCode(value);
  return BRAZILIAN_BANKS_BY_CODE[code] ?? `Banco ${code}`;
}

export function hasBrazilianBankCode(value: string) {
  const code = normalizeBankCode(value);
  return Boolean(BRAZILIAN_BANKS_BY_CODE[code]);
}
