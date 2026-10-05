import type { BillingBankAccount } from "@/features/billing/types";
import type { Payer } from "@/features/payers/types";

export const BILLING_REVIEW_DRAFT_KEY = "fortusys:billing-review-draft";
export const BILLING_RESULT_KEY = "fortusys:billing-result";

export type BillingReviewDraft = {
  assignor: {
    id: string;
    document: string;
    name: string;
  };
  account: {
    id: string;
    label: string;
    bankCode: string;
    accountNumber: string;
    accountDigit: string | null;
  } | null;
  agreement: {
    id: string;
    label: string;
    number: string | null;
    wallet: string | null;
  } | null;
  payer: Pick<
    Payer,
    | "id"
    | "name"
    | "document"
    | "email"
    | "phone"
    | "zipCode"
    | "street"
    | "number"
    | "complement"
    | "district"
    | "city"
    | "state"
  > | null;
  values: {
    accountId: string;
    agreementId: string;
    isHybrid: boolean;
    payerId: string;
    payerSearch: string;
    documentNumber: string;
    ourNumber: string;
    issueDate: string;
    dueDate: string;
    amount: string;
    documentSpecies: string;
    accept: string;
    paymentPlace: string;
    installmentEnabled: boolean;
    installmentCount: string;
    installmentInterval: string;
    interestCode: string;
    interestDate: string;
    interestValue: string;
    fineCode: string;
    fineDate: string;
    fineValue: string;
    discountCode: string;
    discountDate: string;
    discountValue: string;
    protestCode: string;
    protestDays: string;
    writeOffCode: string;
    writeOffDays: string;
    message1: string;
    message2: string;
  };
};

export type BillingRegistrationItem = {
  integrationId: string;
  status: string;
  documentNumber: string;
  installment: string;
  payerName: string;
  payerDocument: string;
  amount: string;
  dueDate: string;
  message: string | null;
};

export type BillingRegistrationResult = {
  createdAt: string;
  payerPhone: string | null;
  successes: BillingRegistrationItem[];
  failures: BillingRegistrationItem[];
};

export function getAgreementDraftLabel(
  agreement: BillingBankAccount["agreements"][number]
) {
  const number = agreement.number ?? String(agreement.id);
  const description = agreement.description || "Sem nome informado";

  return `${number} | ${description}`;
}
