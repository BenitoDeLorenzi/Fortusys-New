export type TecnospeedEnvironment = "homologation" | "production";

export type TecnospeedConfigStatus = {
  environment: TecnospeedEnvironment;
  apiBaseUrl: string;
  guiUrl: string;
  hasSoftwareHouseDocument: boolean;
  hasSoftwareHouseToken: boolean;
  softwareHouseDocument: string | null;
  softwareHouseToken: string | null;
  softwareHouseDocumentPreview: string | null;
  source: "database" | "environment";
  isReady: boolean;
};
