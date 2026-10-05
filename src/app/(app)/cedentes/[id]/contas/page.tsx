import { AssignorAccountsManagement } from "@/features/billing/components/assignor-accounts-management";

type AssignorAccountsPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    document?: string;
    name?: string;
  }>;
};

export default async function AssignorAccountsPage({
  params,
  searchParams,
}: AssignorAccountsPageProps) {
  const { id } = await params;
  const query = await searchParams;

  return (
    <AssignorAccountsManagement
      assignorId={id}
      document={query.document ?? ""}
      name={query.name ?? "Cedente"}
    />
  );
}
