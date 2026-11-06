import { spawn } from "node:child_process";
import { networkInterfaces, type NetworkInterfaceInfo } from "node:os";
import { fileURLToPath } from "node:url";

const WEB_PORT = 5173;

export const WARNING =
  "Achtung: Die App hat keine Anmeldung. Jeder in diesem Netzwerk kann sie öffnen, deine Daten ändern und deine Sicherung herunterladen. Nutze das nur im eigenen Heimnetz und beende es mit Strg+C.";

/** Web addresses of this machine on its networks: non-internal IPv4 only. */
export function lanUrls(interfaces: NodeJS.Dict<NetworkInterfaceInfo[]>, port: number): string[] {
  return Object.values(interfaces)
    .flatMap((list) => list ?? [])
    .filter((info) => info.family === "IPv4" && !info.internal)
    .map((info) => `http://${info.address}:${port}`);
}

/** Starts the API on localhost and Vite on all interfaces, and stops both together. */
function start() {
  const children = [
    spawn("npm", ["run", "dev", "-w", "@skills/server"], { stdio: "inherit" }),
    spawn("npm", ["run", "dev", "-w", "@skills/web", "--", "--host", "0.0.0.0"], { stdio: "inherit" }),
  ];
  const urls = lanUrls(networkInterfaces(), WEB_PORT);
  console.log(`\n${WARNING}\n`);
  console.log(urls.length > 0 ? `Im Heimnetz erreichbar unter:\n${urls.join("\n")}\n` : "Kein Netzwerk gefunden.\n");

  let stopping = false;
  const stop = (code: number) => {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill("SIGTERM");
    process.exitCode = code;
  };
  for (const child of children) child.on("exit", (code) => stop(code ?? 0));
  process.on("SIGINT", () => stop(0));
  process.on("SIGTERM", () => stop(0));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) start();
