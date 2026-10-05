import type {
  TecnospeedConfigStatus,
  TecnospeedEnvironment,
} from "@/features/integrations/tecnospeed/types";
import { createAdminClient } from "@/lib/supabase/admin";

const urlsByEnvironment = {
  homologation: {
    apiBaseUrl: "https://homologacao.plugboleto.com.br/api/v1",
    guiUrl: "http://homologacao.plugboleto.com.br",
  },
  production: {
    apiBaseUrl: "https://plugboleto.com.br/api/v1",
    guiUrl: "https://plugboleto.com.br",
  },
} satisfies Record<
  TecnospeedEnvironment,
  { apiBaseUrl: string; guiUrl: string }
>;

const settingsKey = "tecnospeed";
const maskedSecret = "********";

type StoredTecnospeedSettings = {
  environment?: string;
  softwareHouseDocument?: string;
  softwareHouseToken?: string;
};

function normalizeEnvironment(value?: string): TecnospeedEnvironment {
  return value === "production" ? "production" : "homologation";
}

function maskDocument(value?: string) {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.length <= 4) {
    return "****";
  }

  return `${digits.slice(0, 2)}******${digits.slice(-4)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeStoredSettings(value: unknown): StoredTecnospeedSettings {
  if (!isRecord(value)) {
    return {};
  }

  return {
    environment:
      typeof value.environment === "string" ? value.environment : undefined,
    softwareHouseDocument:
      typeof value.softwareHouseDocument === "string"
        ? value.softwareHouseDocument
        : undefined,
    softwareHouseToken:
      typeof value.softwareHouseToken === "string"
        ? value.softwareHouseToken
        : undefined,
  };
}

async function getStoredTecnospeedSettings() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", settingsKey)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return normalizeStoredSettings(data.value);
  } catch {
    return null;
  }
}

function getEnvironmentTecnospeedSettings(): StoredTecnospeedSettings {
  return {
    environment: process.env.TECNOSPEED_ENVIRONMENT,
    softwareHouseDocument: process.env.TECNOSPEED_SOFTWARE_HOUSE_DOCUMENT,
    softwareHouseToken: process.env.TECNOSPEED_SOFTWARE_HOUSE_TOKEN,
  };
}

function buildTecnospeedConfigStatus(
  settings: StoredTecnospeedSettings,
  source: TecnospeedConfigStatus["source"]
): TecnospeedConfigStatus {
  const environment = normalizeEnvironment(
    settings.environment
  );
  const softwareHouseDocument = settings.softwareHouseDocument;
  const softwareHouseToken = settings.softwareHouseToken;
  const urls = urlsByEnvironment[environment];

  return {
    environment,
    apiBaseUrl: urls.apiBaseUrl,
    guiUrl: urls.guiUrl,
    hasSoftwareHouseDocument: Boolean(softwareHouseDocument),
    hasSoftwareHouseToken: Boolean(softwareHouseToken),
    softwareHouseDocument: softwareHouseDocument ?? null,
    softwareHouseToken: softwareHouseToken ?? null,
    softwareHouseDocumentPreview: maskDocument(softwareHouseDocument),
    source,
    isReady: Boolean(softwareHouseDocument && softwareHouseToken),
  };
}

export async function getTecnospeedConfigStatus() {
  const storedSettings = await getStoredTecnospeedSettings();

  if (storedSettings) {
    return buildTecnospeedConfigStatus(storedSettings, "database");
  }

  return buildTecnospeedConfigStatus(
    getEnvironmentTecnospeedSettings(),
    "environment"
  );
}

export async function getTecnospeedHeaders() {
  const storedSettings = await getStoredTecnospeedSettings();
  const settings = storedSettings ?? getEnvironmentTecnospeedSettings();
  const softwareHouseDocument = settings.softwareHouseDocument;
  const softwareHouseToken = settings.softwareHouseToken;

  if (!softwareHouseDocument || !softwareHouseToken) {
    throw new Error("TecnoSpeed software house credentials are not configured.");
  }

  return {
    "Content-Type": "application/json",
    "cnpj-sh": softwareHouseDocument,
    "token-sh": softwareHouseToken,
  };
}

export async function saveTecnospeedSettings(
  values: StoredTecnospeedSettings
) {
  const currentSettings =
    (await getStoredTecnospeedSettings()) ?? getEnvironmentTecnospeedSettings();
  const softwareHouseDocument = values.softwareHouseDocument?.includes("*")
    ? currentSettings.softwareHouseDocument
    : values.softwareHouseDocument;
  const softwareHouseToken =
    values.softwareHouseToken === maskedSecret
      ? currentSettings.softwareHouseToken
      : values.softwareHouseToken;

  const settings = {
    environment: normalizeEnvironment(values.environment),
    softwareHouseDocument: softwareHouseDocument?.replace(/\D/g, "") ?? "",
    softwareHouseToken: softwareHouseToken ?? "",
  };

  const supabase = createAdminClient();
  const { error } = await supabase.from("app_settings").upsert({
    key: settingsKey,
    value: settings,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(error.message);
  }

  return buildTecnospeedConfigStatus(settings, "database");
}
