export type BillingAssignor = {
  id: number;
  corporateName: string;
  tradeName: string | null;
  document: string;
  email: string | null;
  phone: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  zipCode: string | null;
  city: string | null;
  state: string | null;
  cityIbgeCode: string | null;
  status: string;
  accountsCount: number;
  createdAt: string | null;
};

export type BillingAssignorsResponse = {
  assignors: BillingAssignor[];
};

export type BillingAgreement = {
  id: number;
  number: string | null;
  description: string | null;
  wallet: string | null;
  species: string | null;
  cnabPattern: string | null;
  remittanceNumber: string | null;
  accountId: number;
  active: boolean | null;
  instantRegistration: boolean | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type BillingBankAccount = {
  id: number;
  bankCode: string;
  agency: string;
  agencyDigit: string | null;
  accountNumber: string;
  accountDigit: string | null;
  accountType: string;
  beneficiaryCode: string | null;
  companyCode: string | null;
  assignorId: number;
  active: boolean | null;
  validationActive: boolean | null;
  updatedPrint: boolean | null;
  agreements: BillingAgreement[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type BillingBankAccountsResponse = {
  accounts: BillingBankAccount[];
};

export type BillingTicket = {
  integrationId: string;
  status: string;
  bankCode: string;
  bankName: string;
  ourNumber: string;
  documentNumber: string;
  installment: string;
  payerName: string;
  payerDocument: string;
  payerPhone: string;
  payerEmail: string;
  issueDate: string;
  dueDate: string;
  amount: string;
  boletoUrl: string | null;
  pixUrl: string | null;
  digitableLine: string | null;
  failureMessage: string | null;
  movements: BillingTicketMovement[];
  occurrences: BillingTicketOccurrence[];
};

export type BillingTicketMovement = {
  code: string;
  message: string;
  date: string;
  origin: string | null;
};

export type BillingTicketOccurrence = {
  code: string;
  message: string;
  date: string | null;
};

export type BillingTicketsResponse = {
  tickets: BillingTicket[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
};

export type LocalBillingChargeStatus =
  | "draft"
  | "pending"
  | "pending_emission"
  | "emitted"
  | "emission_failed"
  | "paid"
  | "overdue"
  | "canceled";

export type LocalBillingCharge = {
  id: string;
  description: string;
  amountCents: number;
  dueDate: string;
  status: LocalBillingChargeStatus;
  chargeType: string;
  installmentNumber: number | null;
  installmentTotal: number | null;
  payerId: string | null;
  payerName: string | null;
  payerDocument: string | null;
  assignorName: string | null;
  assignorDocument: string | null;
  provider: "tecnospeed" | null;
  providerReference: string | null;
  providerStatus: string | null;
  providerError: string | null;
  competence: string | null;
  lineItems: Array<{
    key: string;
    label: string;
    amountCents: number;
    description?: string | null;
  }>;
  tecnospeedMessages: {
    message1: string;
    message2: string;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type LocalBillingChargesResponse = {
  charges: LocalBillingCharge[];
  total: number;
};
