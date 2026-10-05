import type { BillingAgreement } from "@/features/billing/types";

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
  api_id?: string | null;
  api_key?: string | null;
  api_secret?: string | null;
  estacao?: string | null;
  tipowebservice?: string | null;
  criado?: string;
  atualizado?: string;
};

export type TecnospeedAgreementPayload = {
  _status: "sucesso" | "erro";
  _mensagem?: string;
  _dados?:
    | TecnospeedAgreement
    | TecnospeedAgreement[]
    | Array<{ _campo?: string; _erro?: string }>;
};

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizePayload(
  data?: TecnospeedAgreement[] | TecnospeedAgreement
) {
  if (!data) {
    return [];
  }

  return Array.isArray(data) ? data : [data];
}

export function normalizeErrorMessage(response: TecnospeedAgreementPayload) {
  if (Array.isArray(response._dados)) {
    const errors = response._dados
      .map((item) => {
        if (!("_erro" in item) || !item._erro) {
          return null;
        }

        const field = "_campo" in item ? getAgreementFieldLabel(item._campo) : null;
        return field ? `${field}: ${item._erro}` : item._erro;
      })
      .filter(Boolean);

    if (errors.length > 0) {
      return errors.join(" ");
    }
  }

  return response._mensagem ?? "Erro ao processar convênio.";
}

export function getAgreementFieldLabel(value?: string) {
  if (!value) {
    return null;
  }

  const labels: Record<string, string> = {
    convenionumero: "Número do convênio",
    conveniodescricao: "Descrição",
    conveniocarteira: "Carteira",
    convenioespecie: "Espécie",
    conveniopadraocnab: "CNAB",
    convenionumeroremessa: "Número da remessa",
    convenioregistroinstantaneo: "Registro instantâneo",
    convenioapiid: "API ID",
    convenioapikey: "API Key",
    convenioapisecret: "API Secret",
    convenioestacao: "Estação",
    conveniotipowebservice: "Tipo do webservice",
  };

  const key = value.toLowerCase().replace(/[^a-z0-9]/g, "");
  return labels[key] ?? value;
}

export function mapAgreement(agreement: TecnospeedAgreement): BillingAgreement {
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

export type AgreementFormPayload = {
  document?: string;
  accountId?: string | number;
  number?: string;
  description?: string;
  wallet?: string;
  species?: string;
  cnabPattern?: string;
  remittanceNumber?: string;
  restartDaily?: boolean;
  manualRemittance?: boolean;
  instantRegistration?: boolean;
  apiId?: string;
  apiKey?: string;
  apiSecret?: string;
  station?: string;
  webserviceType?: string;
};

export function getAgreementBody(payload: AgreementFormPayload) {
  const instantRegistration = Boolean(payload.instantRegistration);

  return {
    ConvenioNumero: payload.number?.trim(),
    ConvenioDescricao: payload.description?.trim(),
    ConvenioCarteira: payload.wallet?.trim(),
    ConvenioEspecie: payload.species?.trim(),
    ConvenioPadraoCNAB: payload.cnabPattern?.trim(),
    ConvenioNumeroRemessa: payload.remittanceNumber?.trim(),
    ConvenioReiniciarDiariamente: Boolean(payload.restartDaily),
    ConvenioNumeroRemessaManual: Boolean(payload.manualRemittance),
    ConvenioRegistroInstantaneo: instantRegistration,
    ConvenioApiId: instantRegistration ? payload.apiId?.trim() : undefined,
    ConvenioApiKey: instantRegistration ? payload.apiKey?.trim() : undefined,
    ConvenioApiSecret: instantRegistration ? payload.apiSecret?.trim() : undefined,
    ConvenioEstacao: instantRegistration ? payload.station?.trim() : undefined,
    Conveniotipowebservice: instantRegistration
      ? payload.webserviceType?.trim()
      : undefined,
    Conta: Number(payload.accountId),
  };
}
