export type RealEstateAsset = {
  id: string;
  firestoreId: string | null;
  code: number | null;
  title: string;
  propertyName: string | null;
  type: string;
  status: string;
  motive: string | null;
  address: string | null;
  notes: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  bedrooms: string | null;
  bathrooms: string | null;
  garage: string | null;
  area: string | null;
  rentAmount: string | null;
  condominiumAmount: string | null;
  iptuAmount: string | null;
  payerIptu: string | null;
  payerCondominium: string | null;
  energyContract: string | null;
  energyMeter: string | null;
  waterContract: string | null;
  waterMeter: string | null;
  registrationNumber: string | null;
  municipalRegistration: string | null;
  photosCount: number;
  landlordFirestoreId: string | null;
  landlordName: string | null;
  landlordDocument: string | null;
  createdAt: string;
};

export type RealEstateAssetsResponse = {
  assets: RealEstateAsset[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
};

export type RealEstateLandlord = {
  firestoreId: string | null;
  name: string | null;
  document: string | null;
};

export type RealEstateLandlordsResponse = {
  landlords: RealEstateLandlord[];
};

export type RealEstateContractModelPurpose = "rental" | "sale";

export type RealEstateContractModelUsage = "residential" | "commercial";

export type RealEstateContractModelStatus = "active" | "inactive";

export type RealEstateContractModelClause = {
  id: string;
  title: string;
  text: string;
  order: number;
};

export type RealEstateContractModel = {
  id: string;
  name: string;
  contractPurpose: RealEstateContractModelPurpose;
  propertyUsage: RealEstateContractModelUsage;
  description: string | null;
  notes: string | null;
  status: RealEstateContractModelStatus;
  isDefault: boolean;
  witness1Name: string | null;
  witness1Document: string | null;
  witness2Name: string | null;
  witness2Document: string | null;
  clauses: RealEstateContractModelClause[];
  createdAt: string;
  updatedAt: string;
};

export type RealEstateContractModelsResponse = {
  models: RealEstateContractModel[];
};

export type RealEstateDashboardContract = {
  id: string;
  assetId: string;
  assetCode: number | null;
  assetTitle: string;
  tenantId: string;
  tenantName: string;
  tenantDocument: string;
  status: "draft" | "active" | "ended" | "canceled";
  contractNumber: string | null;
  startDate: string;
  endDate: string;
  paymentDueDay: number | null;
  rentAmountCents: number;
  createdAt: string;
};

export type RealEstateDashboardTenant = {
  id: string;
  name: string;
  document: string;
  phone: string | null;
  email: string | null;
  activeContracts: number;
  totalContracts: number;
};

export type RealEstateDashboardCharge = {
  id: string;
  assetId: string;
  assetCode: number | null;
  assetTitle: string;
  tenantName: string;
  competenceMonth: number;
  competenceYear: number;
  dueDate: string;
  totalAmountCents: number;
  status: "open" | "paid" | "overdue" | "canceled";
  ticketStatus: "not_generated" | "registering" | "registered" | "failed" | "canceled";
  ticketProviderStatus: string | null;
};

export type RealEstateDashboardAgendaItem = {
  id: string;
  date: string;
  type:
    | "charge_due"
    | "charge_overdue"
    | "ticket_failed"
    | "ticket_registering"
    | "contract_ending"
    | "contract_document"
    | "adjustment"
    | "missing_charge";
  priority: "low" | "medium" | "high";
  assetId: string;
  assetCode: number | null;
  assetTitle: string;
  tenantName: string | null;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
};

export type RealEstateDashboardResponse = {
  summary: {
    totalAssets: number;
    availableAssets: number;
    rentedAssets: number;
    saleAssets: number;
    rentalAssets: number;
    activeContracts: number;
    draftContracts: number;
    endedContracts: number;
    tenants: number;
    monthlyRentCents: number;
    currentCompetenceMonth: number;
    currentCompetenceYear: number;
    expectedChargesCents: number;
    paidChargesCents: number;
    openChargesCents: number;
    overdueChargesCents: number;
    canceledChargesCents: number;
    openCharges: number;
    paidCharges: number;
    overdueCharges: number;
    canceledCharges: number;
    activeTickets: number;
    pendingTickets: number;
    failedTickets: number;
  };
  contracts: RealEstateDashboardContract[];
  tenants: RealEstateDashboardTenant[];
  charges: RealEstateDashboardCharge[];
  agenda: RealEstateDashboardAgendaItem[];
};
