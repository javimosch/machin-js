// A fixed slice of the random differential campaign, so a regression shows up in CI.
// For a wider search: deno run -A tools/fuzz.ts <count> <firstSeed>
import { assertEquals } from "jsr:@std/assert@1";
import { check } from "../tools/fuzz.ts";

for (let seed = 1; seed <= 30; seed++) {
  Deno.test(`random program, seed ${seed}: native == Deno`, async () => {
    const r = await check(seed);
    assertEquals(r.outcome, "same", `${r.detail}\n--- program ---\n${r.source}`);
  });
}
