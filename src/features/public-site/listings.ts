import { createAdminClient } from "@/lib/supabase/admin";

import { publicTypeOptions } from "./options";

export type PublicListing = {
  id: string;
  code: string;
  title: string;
  type: string;
  typeValue?: string;
  purpose: "Aluguel" | "Venda";
  purposeValue?: "aluguel" | "venda";
  district: string;
  city: string;
  state: string;
  area: string;
  bedrooms?: string;
  parking?: string;
  price: string;
  highlight: string;
  image: string;
};

export type PublicListingFilters = {
  finalidade?: string;
  tipo?: string;
  cidade?: string;
};

export type PublicListingSearchResult = {
  listings: PublicListing[];
  total: number;
};

type PublicAssetRow = {
  id: string;
  code: number | null;
  title: string;
  type: string;
  motive: string | null;
  status: string;
  district: string | null;
  city: string | null;
  state: string | null;
  area: string | null;
  bedrooms: string | null;
  garage: string | null;
  rent_amount: string | null;
  photos: unknown;
  metadata: unknown;
  created_at: string;
};

const publicAssetFields =
  "id,code,title,type,motive,status,district,city,state,area,bedrooms,garage,rent_amount,photos,metadata,created_at";

const typeLabels = new Map(
  publicTypeOptions
    .filter((option) => option.value)
    .map((option) => [option.value, option.label])
);

export const featuredListings: PublicListing[] = [
  {
    id: "sample-001",
    code: "FI-1024",
    title: "Apartamento amplo perto de serviços essenciais",
    type: "Apartamento",
    typeValue: "apartment",
    purpose: "Aluguel",
    purposeValue: "aluguel",
    district: "Centro",
    city: "Fortaleza",
    state: "CE",
    area: "86 m²",
    bedrooms: "3 quartos",
    parking: "1 vaga",
    price: "Consulte",
    highlight: "Contrato digital e vistoria acompanhada pela imobiliária.",
    image: "/images/fortulino-hero-interior.png",
  },
  {
    id: "sample-002",
    code: "FI-1188",
    title: "Casa pronta para morar em rua tranquila",
    type: "Casa",
    typeValue: "house",
    purpose: "Venda",
    purposeValue: "venda",
    district: "Bairro residencial",
    city: "Fortaleza",
    state: "CE",
    area: "142 m²",
    bedrooms: "4 quartos",
    parking: "2 vagas",
    price: "Consulte",
    highlight: "Análise documental conduzida com suporte do time Fortulino.",
    image: "/images/fortulino-hero-interior.png",
  },
  {
    id: "sample-003",
    code: "FI-1210",
    title: "Sala comercial para atendimento ou escritório",
    type: "Sala",
    typeValue: "room",
    purpose: "Aluguel",
    purposeValue: "aluguel",
    district: "Aldeota",
    city: "Fortaleza",
    state: "CE",
    area: "48 m²",
    parking: "Rotativo",
    price: "Consulte",
    highlight: "Opção prática para empresas que precisam entrar rápido.",
    image: "/images/fortulino-hero-interior.png",
  },
];

export const publicIntegrationNote =
  "Substituir este catálogo por uma consulta aos imóveis publicados do Fortusys quando o módulo de publicação estiver ativo.";

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function getMetadataString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPurposeValue(row: PublicAssetRow): "aluguel" | "venda" {
  const motive = normalize(row.motive ?? getMetadataString(row.metadata, "motivo"));

  return motive.includes("venda") ? "venda" : "aluguel";
}

function getPurposeLabel(value: "aluguel" | "venda") {
  return value === "venda" ? "Venda" : "Aluguel";
}

function getPrice(row: PublicAssetRow, purpose: "aluguel" | "venda") {
  if (purpose === "venda") {
    return "Consulte";
  }

  const amount = row.rent_amount?.trim();

  if (!amount) {
    return "Consulte";
  }

  return amount.toLowerCase().includes("r$") ? amount : `R$ ${amount}`;
}

function formatArea(area?: string | null) {
  const value = area?.trim();

  if (!value) {
    return "Área sob consulta";
  }

  return /m|²/i.test(value) ? value : `${value} m²`;
}

function formatRooms(value: string | null, singular: string, plural: string) {
  const text = value?.trim();

  if (!text) {
    return undefined;
  }

  if (/[a-zà-ú]/i.test(text)) {
    return text;
  }

  return `${text} ${text === "1" ? singular : plural}`;
}

function getListingImage() {
  return "/images/fortulino-hero-interior.png";
}

function mapPublicAsset(row: PublicAssetRow): PublicListing {
  const purposeValue = getPurposeValue(row);

  return {
    id: row.id,
    code: row.code ? `FI-${row.code}` : "FI",
    title: row.title,
    type: typeLabels.get(row.type) ?? "Outro",
    typeValue: row.type,
    purpose: getPurposeLabel(purposeValue),
    purposeValue,
    district: row.district ?? "Bairro não informado",
    city: row.city ?? "Cidade não informada",
    state: row.state ?? "UF",
    area: formatArea(row.area),
    bedrooms: formatRooms(row.bedrooms, "quarto", "quartos"),
    parking: formatRooms(row.garage, "vaga", "vagas"),
    price: getPrice(row, purposeValue),
    highlight: "Atendimento Fortulino para mais detalhes do imóvel.",
    image: getListingImage(),
  };
}

function isValidPurpose(value?: string) {
  return value === "aluguel" || value === "venda";
}

function getValidType(value?: string) {
  return publicTypeOptions.some((option) => option.value && option.value === value)
    ? value
    : undefined;
}

function filterFallbackListings(filters: PublicListingFilters) {
  return featuredListings.filter((listing) => {
    if (isValidPurpose(filters.finalidade) && listing.purposeValue !== filters.finalidade) {
      return false;
    }

    if (filters.tipo && listing.typeValue !== filters.tipo) {
      return false;
    }

    if (filters.cidade && normalize(listing.city) !== normalize(filters.cidade)) {
      return false;
    }

    return true;
  });
}

export async function getPublicListings(
  filters: PublicListingFilters = {}
): Promise<PublicListingSearchResult> {
  const purpose = isValidPurpose(filters.finalidade)
    ? filters.finalidade
    : undefined;
  const type = getValidType(filters.tipo);
  const city = filters.cidade?.trim();

  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("real_estate_assets")
      .select(publicAssetFields, { count: "exact" })
      .in("status", ["available", "renovation", "disponivel", "emreforma"])
      .order("code", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(24);

    if (purpose) {
      query = query.or(`motive.eq.${purpose},metadata->>motivo.eq.${purpose}`);
    }

    if (type) {
      query = query.eq("type", type);
    }

    if (city) {
      query = query.eq("city", city);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return {
      listings: ((data ?? []) as PublicAssetRow[]).map(mapPublicAsset),
      total: count ?? 0,
    };
  } catch {
    const listings = filterFallbackListings({ finalidade: purpose, tipo: type, cidade: city });

    return {
      listings,
      total: listings.length,
    };
  }
}
