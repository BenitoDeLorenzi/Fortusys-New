import { Suspense } from "react";

import { RealEstateManagement } from "@/features/real-estate/components/real-estate-management";

export default function RealEstatePage() {
  return (
    <Suspense fallback={null}>
      <RealEstateManagement />
    </Suspense>
  );
}
