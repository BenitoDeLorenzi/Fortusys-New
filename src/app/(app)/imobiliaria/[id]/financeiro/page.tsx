import { Suspense } from "react";

import { RealEstateAssetFinanceManagement } from "@/features/real-estate/components/real-estate-asset-finance-management";

type RealEstateAssetFinancePageProps = {
  params: Promise<{ id: string }>;
};

export default async function RealEstateAssetFinancePage({
  params,
}: RealEstateAssetFinancePageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={null}>
      <RealEstateAssetFinanceManagement assetId={id} />
    </Suspense>
  );
}
