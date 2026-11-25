// Build the site into _site/.
//why: Lume's programmatic API, pinned to 3.2.0 — newer releases need a newer Deno (node registerHooks).
import site from "./_config.ts";
await site.build();
