alter table public.real_estate_leases
  add column if not exists document_status text not null default 'not_generated'
  check (
    document_status in (
      'not_generated',
      'draft_generated',
      'pending_signature',
      'signed'
    )
  );

create index if not exists real_estate_leases_document_status_idx
  on public.real_estate_leases(document_status);

notify pgrst, 'reload schema';
