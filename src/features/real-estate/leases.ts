export type RealEstateLeaseStatus =
  | "draft"
  | "active"
  | "ended"
  | "canceled";

export type RealEstateLeaseDocumentStatus =
  | "not_generated"
  | "draft_generated"
  | "pending_signature"
  | "signed";

export type RealEstateLeaseGuarantee =
  | "none"
  | "deposit"
  | "guarantor"
  | "insurance"
  | "capitalization";

export type RealEstateLeaseAdjustment = "none" | "ipca" | "igpm" | "other";

export type RealEstateContractEventType =
  | "created"
  | "updated"
  | "activated"
  | "ended"
  | "canceled"
  | "renewed";

export type RealEstateLease = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantDocument: string;
  status: RealEstateLeaseStatus;
  documentStatus: RealEstateLeaseDocumentStatus;
  contractNumber: string | null;
  startDate: string;
  endDate: string;
  paymentDueDay: number | null;
  rentAmountCents: number;
  guaranteeType: RealEstateLeaseGuarantee;
  guaranteeAmountCents: number | null;
  guarantorId: string | null;
  guarantorName: string | null;
  guarantorDocument: string | null;
  adjustmentIndex: RealEstateLeaseAdjustment;
  nextAdjustmentDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RealEstateContractEvent = {
  id: string;
  type: RealEstateContractEventType;
  title: string;
  description: string | null;
  createdAt: string;
};

export type RealEstateLeaseManagementResponse = {
  asset: {
    id: string;
    code: number | null;
    title: string;
    motive: string | null;
    status: string;
    address: string | null;
    landlordName: string | null;
    landlordDocument: string | null;
  };
  lease: RealEstateLease | null;
  events: RealEstateContractEvent[];
};

export type RealEstateContractDetailsResponse = {
  asset: {
    id: string;
    code: number | null;
    title: string;
    motive: string | null;
    status: string;
    address: string | null;
    landlordName: string | null;
    landlordDocument: string | null;
  };
  lease: RealEstateLease;
  landlord: {
    name: string | null;
    document: string | null;
  };
  tenant: {
    id: string;
    name: string;
    document: string;
    email: string | null;
    phone: string | null;
  };
  guarantor: {
    id: string;
    name: string;
    document: string;
    email: string | null;
    phone: string | null;
  } | null;
  events: RealEstateContractEvent[];
};
