import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Auth from "@/components/auth";
export const dynamic = "force-dynamic";
export default async function Page() {
  if (await db.user.count()) redirect("/login");
  return <Auth setup />;
}
