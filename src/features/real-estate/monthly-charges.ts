export type RealEstateMonthlyChargePreviewStatus =
  | "not_launched"
  | "launched"
  | "missing_data"
  | "outside_period";

export type RealEstateMonthlyChargeStatus =
  | "open"
  | "paid"
  | "overdue"
  | "canceled";

export type RealEstateMonthlyChargeTicketStatus =
  | "not_generated"
  | "registering"
  | "registered"
  | "failed"
  | "canceled";

export type RealEstateMonthlyChargePreviewItem = {
  leaseId: string;
  assetId: string;
  assetCode: number | null;
  assetTitle: string;
  tenantId: string;
  tenantName: string;
  tenantDocument: string;
  contractNumber: string | null;
  startDate: string;
  endDate: string;
  dueDate: string | null;
  paymentDueDay: number | null;
  rentAmountCents: number;
  chargeId: string | null;
  chargeStatus: RealEstateMonthlyChargeStatus | null;
  ticketStatus: RealEstateMonthlyChargeTicketStatus | null;
  ticketProviderStatus: string | null;
  totalAmountCents: number | null;
  status: RealEstateMonthlyChargePreviewStatus;
  statusLabel: string;
  reason: string | null;
};

export type RealEstateMonthlyChargesPreviewResponse = {
  competenceMonth: number;
  competenceYear: number;
  summary: {
    totalContracts: number;
    launched: number;
    notLaunched: number;
    missingData: number;
    outsidePeriod: number;
    open: number;
    paid: number;
    overdue: number;
    canceled: number;
    expectedRentCents: number;
    launchedAmountCents: number;
    paidAmountCents: number;
  };
  items: RealEstateMonthlyChargePreviewItem[];
};
