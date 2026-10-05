import { redirect } from "next/navigation";

type RealEstateMonthlyChargesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RealEstateMonthlyChargesPage({
  searchParams,
}: RealEstateMonthlyChargesPageProps) {
  const params = await searchParams;
  const nextParams = new URLSearchParams({ tab: "cobrancas" });

  for (const [key, value] of Object.entries(params)) {
    if (key === "tab") {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => nextParams.append(key, item));
      continue;
    }

    if (value) {
      nextParams.set(key, value);
    }
  }

  redirect(`/imobiliaria?${nextParams.toString()}`);
}
