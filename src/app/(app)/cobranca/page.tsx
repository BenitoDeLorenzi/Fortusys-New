import { Suspense } from "react";

import { BillingManagement } from "@/features/billing/components/billing-management";

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingManagement />
    </Suspense>
  );
}
