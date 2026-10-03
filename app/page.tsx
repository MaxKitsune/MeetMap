import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { owner } from "@/lib/security";
import { appData } from "@/lib/data";
import MeetMap from "@/components/app";
import type { AppData } from "@/lib/types";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (!(await db.user.count())) redirect("/setup");
  const user = await owner();
  if (!user) redirect("/login");
  const data = JSON.parse(JSON.stringify(await appData(user))) as AppData;
  return <MeetMap initialData={data} />;
}
