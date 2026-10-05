import { Suspense } from "react";

import { RealEstateDocumentsManagement } from "@/features/real-estate/components/real-estate-documents-management";

type RealEstateDocumentsPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function RealEstateDocumentsPage({
  params,
}: RealEstateDocumentsPageProps) {
  const { id } = await params;

  return (
    <Suspense fallback={null}>
      <RealEstateDocumentsManagement assetId={id} />
    </Suspense>
  );
}
