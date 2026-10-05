import { redirect } from "next/navigation";

type RealEstateManagementPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RealEstateManagementPage({
  params,
}: RealEstateManagementPageProps) {
  const { id } = await params;

  redirect(`/imobiliaria/${id}/contratos`);
}
