import { NewBillingManagement } from "@/features/billing/components/new-billing-management";

type NewBillingPageProps = {
  searchParams: Promise<{
    assignorId?: string;
    document?: string;
    name?: string;
  }>;
};

export default async function NewBillingPage({
  searchParams,
}: NewBillingPageProps) {
  const query = await searchParams;

  return (
    <NewBillingManagement
      assignorId={query.assignorId ?? ""}
      document={query.document ?? ""}
      name={query.name ?? "Cedente"}
    />
  );
}
