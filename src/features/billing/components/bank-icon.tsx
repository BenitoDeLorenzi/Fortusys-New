"use client";

import Image from "next/image";
import { useState } from "react";
import { Landmark } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { normalizeBankCode } from "@/features/billing/banks";
import { bankLogoCodes } from "@/features/billing/bank-logo-codes";

export function BankIcon({ code, name }: { code: string; name: string }) {
  const normalizedCode = normalizeBankCode(code);
  const [failedCode, setFailedCode] = useState<string | null>(null);
  const hasLogo = bankLogoCodes.has(normalizedCode) && failedCode !== normalizedCode;
  const label = name || "Banco não informado";

  return (
    <Tooltip>
      <TooltipTrigger
        render={<span tabIndex={0} aria-label={label} />}
        className="inline-flex size-7 items-center justify-center align-middle outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {hasLogo ? (
          <Image
            src={`/banks/${normalizedCode}.png`}
            alt=""
            width={28}
            height={28}
            className="size-7 object-contain"
            onError={() => setFailedCode(normalizedCode)}
          />
        ) : (
          <Landmark className="size-5 text-slate-500" aria-hidden="true" />
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
