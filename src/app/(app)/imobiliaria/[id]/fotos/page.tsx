import { Suspense } from "react";

import { RealEstatePhotosManagement } from "@/features/real-estate/components/real-estate-photos-management";

type RealEstatePhotosPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RealEstatePhotosPage({
  params,
}: RealEstatePhotosPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={null}>
      <RealEstatePhotosManagement assetId={id} />
    </Suspense>
  );
}
