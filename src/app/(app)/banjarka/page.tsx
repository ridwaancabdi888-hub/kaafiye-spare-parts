import { getFx, getStaffNames, requireMember } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { localDate } from "@/lib/format";
import type { BanjarkaRecord } from "@/lib/types";
import { FxWidget } from "@/components/FxWidget";
import { PageHeader, SectionHeader } from "@/components/kit";
import { BanjarkaList } from "@/components/lists";
import { BanjarkaForm } from "./BanjarkaForm";

export const metadata = { title: "Banjarka" };

export default async function BanjarkaPage() {
  const s = await requireMember();
  const t = await getT();
  // RLS decides visibility: own records, or all if admin / the business allows it.
  const [fx, staff, records] = await Promise.all([
    getFx(s.business.id),
    getStaffNames(s.business.id),
    s.supabase.from("banjarka_records").select("*").eq("business_id", s.business.id)
      .order("work_date", { ascending: false }).order("created_at", { ascending: false }).limit(60),
  ]);

  return (
    <>
      <PageHeader title={t("bj.title")} subtitle={t("bj.subtitle")} />
      <FxWidget rate={fx?.rate ?? null} staleHours={fx?.staleHours ?? 24} canChange={s.isAdmin} />
      <BanjarkaForm today={localDate()} />
      <SectionHeader title={t("bj.history")} />
      <BanjarkaList rows={(records.data ?? []) as BanjarkaRecord[]} ctx={{ userId: s.user.id, isAdmin: s.isAdmin, names: staff.names }} />
    </>
  );
}
