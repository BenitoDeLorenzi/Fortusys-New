import { Suspense } from "react";

import { NewRealEstateAssetManagement } from "@/features/real-estate/components/new-real-estate-asset-management";

type NewRealEstateAssetPageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function NewRealEstateAssetPage({
  searchParams,
}: NewRealEstateAssetPageProps) {
  const { id } = await searchParams;

  return (
    <Suspense fallback={null}>
      <NewRealEstateAssetManagement assetId={id} />
    </Suspense>
  );
}
