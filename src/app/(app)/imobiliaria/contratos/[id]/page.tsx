import { Suspense } from "react";

import { RealEstateContractDetailManagement } from "@/features/real-estate/components/real-estate-contract-detail-management";

type RealEstateContractDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function RealEstateContractDetailPage({
  params,
}: RealEstateContractDetailPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={null}>
      <RealEstateContractDetailManagement contractId={id} />
    </Suspense>
  );
}
