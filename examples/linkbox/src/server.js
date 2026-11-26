import { env, parse_int, eprintln, exit } from "machin";
import { serve } from "machin/web";
import { handle } from "./routes.js";

/**
 * Start the API on $PORT (default 8090). $LINKBOX_TOKEN is required.
 * @returns {void}
 */
export function main() {
  //why: with no token, "Bearer " alone would be accepted, so refuse to start instead.
  if (env("LINKBOX_TOKEN") == "") {
    eprintln("linkbox: set LINKBOX_TOKEN to a secret before starting");
    exit(2);
  }
  const fromEnv = parse_int(env("PORT"));
  const port = fromEnv == 0 ? 8090 : fromEnv;
  serve(port, handle);
}
