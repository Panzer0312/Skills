import type { ReactNode } from "react";
import { useDevices } from "./useDevices.js";

/** Shows the children only when the device may be used; otherwise the fallback (default: nothing). */
export function RequireDevice({
  what,
  children,
  fallback = null,
}: {
  what: "mic";
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { canUse } = useDevices();
  return <>{canUse(what) ? children : fallback}</>;
}
