export type RealEstateChargeStatus = "open" | "paid" | "overdue" | "canceled";

export type RealEstateChargeTicketStatus =
  | "not_generated"
  | "registering"
  | "registered"
  | "failed"
  | "canceled";

export type RealEstateChargeItemType =
  | "rent"
  | "iptu"
  | "condominium"
  | "reserve_fund"
  | "water"
  | "energy"
  | "trash"
  | "gas"
  | "other"
  | "discount";

export type RealEstateChargeItem = {
  id: string;
  type: RealEstateChargeItemType;
  description: string | null;
  amountCents: number;
};

export type RealEstateCharge = {
  id: string;
  assetId: string;
  leaseId: string;
  tenantId: string;
  tenantName: string;
  tenantDocument: string;
  tenantPhone: string | null;
  contractNumber: string | null;
  contractCode: number | null;
  competenceMonth: number;
  competenceYear: number;
  dueDate: string;
  rentAmountCents: number;
  additionalAmountCents: number;
  discountAmountCents: number;
  totalAmountCents: number;
  status: RealEstateChargeStatus;
  ticketStatus: RealEstateChargeTicketStatus;
  ticketProviderStatus: string | null;
  ticketIntegrationId: string | null;
  ticketAssignorDocument: string | null;
  ticketDocumentNumber: string | null;
  ticketOurNumber: string | null;
  ticketUrl: string | null;
  ticketDigitableLine: string | null;
  ticketPixUrl: string | null;
  ticketErrorMessage: string | null;
  hasTicketAttempts: boolean;
  notes: string | null;
  items: RealEstateChargeItem[];
  createdAt: string;
};

export type RealEstateChargesResponse = {
  asset: {
    id: string;
    code: number | null;
    title: string;
    address: string | null;
    status: string;
  };
  activeContract: {
    id: string;
    code: number | null;
    contractNumber: string | null;
    tenantId: string;
    tenantName: string;
    tenantDocument: string;
    paymentDueDay: number | null;
    rentAmountCents: number;
  } | null;
  charges: RealEstateCharge[];
};
