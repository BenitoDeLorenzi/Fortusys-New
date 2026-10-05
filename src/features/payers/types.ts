export type ClientRole = "payer" | "tenant" | "buyer" | "guarantor";

export type Payer = {
  id: string;
  firestoreId: string | null;
  code: number | null;
  name: string;
  document: string;
  email: string | null;
  phone: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  status: "active" | "inactive";
  roles: ClientRole[];
  createdAt: string;
};

export type PayersResponse = {
  payers: Payer[];
  hasMore: boolean;
  total: number;
};
