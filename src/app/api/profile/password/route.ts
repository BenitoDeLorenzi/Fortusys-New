import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ChangePasswordPayload = {
  currentPassword?: string;
  newPassword?: string;
};

export async function POST(request: NextRequest) {
  const payload = (await request.json()) as ChangePasswordPayload;
  const currentPassword = payload.currentPassword?.trim();
  const newPassword = payload.newPassword?.trim();

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { message: "Informe a senha atual e a nova senha." },
      { status: 400 }
    );
  }

  if (newPassword.length < 8) {
    return NextResponse.json(
      { message: "A nova senha deve ter pelo menos 8 caracteres." },
      { status: 400 }
    );
  }

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { message: "A nova senha precisa ser diferente da senha atual." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    return NextResponse.json(
      { message: "Supabase não está configurado corretamente." },
      { status: 500 }
    );
  }

  const authClient = createSupabaseClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const verifyResult = await authClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (verifyResult.error) {
    return NextResponse.json(
      { message: "Senha atual inválida." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const updateResult = await admin.auth.admin.updateUserById(user.id, {
    password: newPassword,
  });

  if (updateResult.error) {
    return NextResponse.json(
      { message: updateResult.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: "Senha atualizada com sucesso.",
  });
}
