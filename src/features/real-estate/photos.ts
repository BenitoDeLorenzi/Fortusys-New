export const REAL_ESTATE_PHOTOS_BUCKET = "real-estate-photos";
export const REAL_ESTATE_PHOTO_MAX_BYTES = 6 * 1024 * 1024;
export const REAL_ESTATE_PHOTO_LIMIT = 30;
export const REAL_ESTATE_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type RealEstatePhoto = {
  id: string;
  url: string;
  originalName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  isCover: boolean;
  sortOrder: number;
  createdAt: string | null;
  isLegacy: boolean;
};

export type RealEstatePhotosResponse = {
  asset: {
    id: string;
    code: number | null;
    title: string;
  };
  photos: RealEstatePhoto[];
  limit: number;
};
