import { AssignorWebhookManagement } from "@/features/billing/components/assignor-webhook-management";

type AssignorWebhookPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    document?: string;
    name?: string;
  }>;
};

export default async function AssignorWebhookPage({
  params,
  searchParams,
}: AssignorWebhookPageProps) {
  const { id } = await params;
  const query = await searchParams;

  return (
    <AssignorWebhookManagement
      assignorId={id}
      document={query.document ?? ""}
      name={query.name ?? "Cedente"}
    />
  );
}
