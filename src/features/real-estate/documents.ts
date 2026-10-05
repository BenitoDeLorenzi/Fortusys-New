export const REAL_ESTATE_DOCUMENTS_BUCKET = "real-estate-documents";
export const REAL_ESTATE_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024;
export const REAL_ESTATE_DOCUMENT_LIMIT = 50;
export const REAL_ESTATE_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
] as const;

export type RealEstateDocument = {
  id: string;
  url: string;
  downloadUrl: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  leaseId?: string | null;
  scope?: string | null;
  documentType?: string | null;
  templateType?: "residential" | "commercial" | string | null;
};

export type RealEstateDocumentsResponse = {
  asset: {
    id: string;
    code: number | null;
    title: string;
  };
  documents: RealEstateDocument[];
  limit: number;
};
