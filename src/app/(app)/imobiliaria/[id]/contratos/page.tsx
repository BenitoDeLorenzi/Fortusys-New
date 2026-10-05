import { Suspense } from "react";

import { RealEstateAssetContractsManagement } from "@/features/real-estate/components/real-estate-asset-contracts-management";

type RealEstateAssetContractsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RealEstateAssetContractsPage({
  params,
}: RealEstateAssetContractsPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={null}>
      <RealEstateAssetContractsManagement assetId={id} />
    </Suspense>
  );
}
