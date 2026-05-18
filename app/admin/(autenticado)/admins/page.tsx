import { getAdminFromCookie } from "@/lib/admin/session";
import { listAdmins } from "@/lib/admin/admins";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { AdminsClient } from "@/components/admin/admins-client";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const supabase = createSupabaseAdminClient();
  const [admins, session] = await Promise.all([
    listAdmins(supabase),
    getAdminFromCookie(),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Admins</h1>
        <p className="mt-1 text-sm text-slate-600">
          {admins.length} {admins.length === 1 ? "admin" : "admins"} no total
        </p>
      </header>
      <AdminsClient initial={admins} selfAdminId={session?.adminId ?? ""} />
    </div>
  );
}
