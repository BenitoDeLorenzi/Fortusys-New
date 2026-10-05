export type DatabaseStatus = {
  hasUrl: boolean;
  hasPublishableKey: boolean;
  hasSecretKey: boolean;
  isConnected: boolean;
  schemaApplied: boolean;
  rolesCount: number | null;
  error: string | null;
};
