import type {
  BillingAgreement,
  BillingBankAccount,
} from "@/features/billing/types";

export type TecnospeedAgreement = {
  id: number;
  numero_convenio?: string;
  descricao_convenio?: string;
  carteira?: string;
  especie?: string;
  padraoCNAB?: string;
  numero_remessa?: string | number | null;
  id_conta?: number;
  ativo?: boolean;
  registro_automatico?: boolean;
  criado?: string;
  atualizado?: string;
};

export type TecnospeedBankAccount = {
  id: number;
  codigo_banco?: string;
  agencia?: string;
  agencia_dv?: string | null;
  conta?: string;
  conta_dv?: string | null;
  tipo_conta?: string;
  cod_beneficiario?: string | null;
  cod_empresa?: string | null;
  id_cedente?: number;
  ativo?: boolean;
  validacao_ativa?: boolean;
  impressao_atualizada?: boolean;
  convenios?: TecnospeedAgreement[];
  criado?: string;
  atualizado?: string;
};

export type TecnospeedAccountsPayload = {
  _status: "sucesso" | "erro";
  _mensagem?: string;
  _dados?:
    | TecnospeedBankAccount
    | TecnospeedBankAccount[]
    | Array<{ _campo?: string; _erro?: string }>;
};

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizePayload(
  data?: TecnospeedBankAccount[] | TecnospeedBankAccount
) {
  if (!data) {
    return [];
  }

  return Array.isArray(data) ? data : [data];
}

export function normalizeErrorMessage(response: TecnospeedAccountsPayload) {
  if (Array.isArray(response._dados)) {
    const errors = response._dados
      .map((item) => {
        if (!("_erro" in item) || !item._erro) {
          return null;
        }

        const field = "_campo" in item ? getAccountFieldLabel(item._campo) : null;
        return field ? `${field}: ${item._erro}` : item._erro;
      })
      .filter(Boolean);

    if (errors.length > 0) {
      return errors.join(" ");
    }
  }

  return response._mensagem ?? "Erro ao processar conta.";
}

export function getAccountFieldLabel(value?: string) {
  if (!value) {
    return null;
  }

  const labels: Record<string, string> = {
    contacodigobanco: "Banco",
    contaagencia: "Agência",
    contaagenciadv: "Dígito da agência",
    contanumero: "Conta",
    contanumerodv: "Dígito da conta",
    contatipo: "Tipo da conta",
    contacodigobeneficiario: "Código beneficiário",
    contacodigoempresa: "Código empresa",
    contavalidacaoativa: "Validação ativa",
    contaimpressaoatualizada: "Impressão atualizada",
  };

  const key = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return labels[key] ?? value;
}

export function mapAgreement(
  agreement: TecnospeedAgreement
): BillingAgreement {
  return {
    id: agreement.id,
    number: agreement.numero_convenio ?? null,
    description: agreement.descricao_convenio ?? null,
    wallet: agreement.carteira ?? null,
    species: agreement.especie ?? null,
    cnabPattern: agreement.padraoCNAB ?? null,
    remittanceNumber:
      agreement.numero_remessa !== undefined && agreement.numero_remessa !== null
        ? String(agreement.numero_remessa)
        : null,
    accountId: agreement.id_conta ?? 0,
    active: agreement.ativo ?? null,
    instantRegistration: agreement.registro_automatico ?? null,
    createdAt: agreement.criado ?? null,
    updatedAt: agreement.atualizado ?? null,
  };
}

export function mapBankAccount(
  account: TecnospeedBankAccount
): BillingBankAccount {
  return {
    id: account.id,
    bankCode: account.codigo_banco ?? "",
    agency: account.agencia ?? "",
    agencyDigit: account.agencia_dv ?? null,
    accountNumber: account.conta ?? "",
    accountDigit: account.conta_dv ?? null,
    accountType: account.tipo_conta ?? "CORRENTE",
    beneficiaryCode: account.cod_beneficiario ?? null,
    companyCode: account.cod_empresa ?? null,
    assignorId: account.id_cedente ?? 0,
    active: account.ativo ?? null,
    validationActive: account.validacao_ativa ?? null,
    updatedPrint: account.impressao_atualizada ?? null,
    agreements: account.convenios?.map(mapAgreement) ?? [],
    createdAt: account.criado ?? null,
    updatedAt: account.atualizado ?? null,
  };
}
