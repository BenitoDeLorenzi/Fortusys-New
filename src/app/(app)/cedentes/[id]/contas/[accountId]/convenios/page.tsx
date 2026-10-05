import { AccountAgreementsManagement } from "@/features/billing/components/account-agreements-management";

type AccountAgreementsPageProps = {
  params: Promise<{
    id: string;
    accountId: string;
  }>;
  searchParams: Promise<{
    document?: string;
    name?: string;
  }>;
};

export default async function AccountAgreementsPage({
  params,
  searchParams,
}: AccountAgreementsPageProps) {
  const { id, accountId } = await params;
  const query = await searchParams;

  return (
    <AccountAgreementsManagement
      accountId={accountId}
      assignorId={id}
      document={query.document ?? ""}
      name={query.name ?? "Cedente"}
    />
  );
}
