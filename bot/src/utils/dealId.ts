import type { Hex } from "viem";

/** Pad a short deal ID string into a bytes32 hex value. */
export function toDealIdBytes32(dealId: string): Hex {
  const hex = Buffer.from(dealId, "utf8").toString("hex");
  return `0x${hex.padEnd(64, "0")}` as Hex;
}
