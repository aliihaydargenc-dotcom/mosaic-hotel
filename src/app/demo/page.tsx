import Workspace from "../workspace";
import { demoActor, demoState } from "@/lib/demo";
export const dynamic = "force-dynamic";
export default function DemoPage() {
  return (
    <Workspace initial={demoState()} actor={demoActor} local={false} demo />
  );
}
