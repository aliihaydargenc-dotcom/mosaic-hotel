import Login from "./login";
import { localMode } from "@/lib/db";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Login local={localMode()} />;
}
