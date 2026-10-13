import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth";
import { getState, localMode } from "@/lib/db";
import Workspace from "./workspace";
export const dynamic = "force-dynamic";
export default async function Page() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const state = await getState();
  return <Workspace initial={state} actor={actor} local={localMode()} />;
}
