import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PageStubProps = {
  badge: string;
  title: string;
  icon: LucideIcon;
};

export function PageStub({ badge, title, icon: Icon }: PageStubProps) {
  return (
    <div className="space-y-6">
      <section>
        <Badge className="mb-3 bg-primary/10 text-primary hover:bg-primary/10">
          {badge}
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {title}
        </h1>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon className="size-5 text-primary" />
            Estrutura inicial
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            Próxima etapa do Fortusys.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
