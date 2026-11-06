import type { NetworkInterfaceInfo } from "node:os";
import { describe, expect, it } from "vitest";
import { lanUrls, WEB_ARGS } from "./devLan.js";

function nic(address: string, family: "IPv4" | "IPv6", internal = false): NetworkInterfaceInfo {
  return { address, family, internal } as NetworkInterfaceInfo;
}

describe("lanUrls", () => {
  it("returns the web address of a non-internal IPv4 interface", () => {
    const urls = lanUrls({ eth0: [nic("fe80::1", "IPv6"), nic("192.168.1.20", "IPv4")] }, 5173);
    expect(urls).toEqual(["http://192.168.1.20:5173"]);
  });

  it("skips internal interfaces", () => {
    expect(lanUrls({ lo: [nic("127.0.0.1", "IPv4", true)] }, 5173)).toEqual([]);
  });

  it("returns nothing without a network", () => {
    expect(lanUrls({}, 5173)).toEqual([]);
    expect(lanUrls({ eth0: undefined }, 5173)).toEqual([]);
  });
});

describe("WEB_ARGS", () => {
  it("fails instead of moving to another port, so the printed URLs stay true", () => {
    expect(WEB_ARGS).toContain("--strictPort");
    expect(WEB_ARGS).toContain("--host");
  });
});
