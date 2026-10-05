import { createAdminClient } from "@/lib/supabase/admin";

export type PublicRealEstateOption = {
  value: string;
  label: string;
};

export type PublicRealEstateOptions = {
  purposes: PublicRealEstateOption[];
  types: PublicRealEstateOption[];
  cities: PublicRealEstateOption[];
};

export const publicPurposeOptions: PublicRealEstateOption[] = [
  { value: "", label: "Locação/Venda" },
  { value: "aluguel", label: "Locação" },
  { value: "venda", label: "Venda" },
];

export const publicTypeOptions: PublicRealEstateOption[] = [
  { value: "", label: "Todas as opções" },
  { value: "house", label: "Casa" },
  { value: "apartment", label: "Apartamento" },
  { value: "office", label: "Escritório" },
  { value: "room", label: "Sala" },
  { value: "condominium", label: "Condomínio" },
  { value: "warehouse", label: "Galpão" },
  { value: "commercial", label: "Comercial" },
  { value: "land", label: "Terreno" },
  { value: "residential", label: "Residencial" },
  { value: "seasonal", label: "Temporada" },
  { value: "other", label: "Outro" },
];

const fallbackCities: PublicRealEstateOption[] = [
  { value: "", label: "Todas as cidades" },
];

function normalizeCity(city: string) {
  return city.trim().replace(/\s+/g, " ");
}

export async function getPublicRealEstateOptions(): Promise<PublicRealEstateOptions> {
  let data: { city: string | null }[] = [];

  try {
    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
      .from("real_estate_assets")
      .select("city")
      .not("city", "is", null)
      .in("status", ["available", "renovation"])
      .order("city", { ascending: true })
      .limit(1000);

    if (error) {
      throw error;
    }

    data = rows ?? [];
  } catch {
    return {
      purposes: publicPurposeOptions,
      types: publicTypeOptions,
      cities: fallbackCities,
    };
  }

  const cityLabels = Array.from(
    new Set(
      (data ?? [])
        .map((item) => (typeof item.city === "string" ? normalizeCity(item.city) : ""))
        .filter(Boolean)
    )
  );

  return {
    purposes: publicPurposeOptions,
    types: publicTypeOptions,
    cities: [
      ...fallbackCities,
      ...cityLabels.map((city) => ({ value: city, label: city })),
    ],
  };
}
