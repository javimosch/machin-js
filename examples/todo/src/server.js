import { env, parse_int } from "machin";
import { serve } from "machin/web";
import { handle } from "./routes.js";

/**
 * Start the todo server on $PORT (default 8080).
 * @returns {void}
 */
export function main() {
  //why: PORT lets tests run on their own port.
  const fromEnv = parse_int(env("PORT"));
  const port = fromEnv == 0 ? 8080 : fromEnv;
  serve(port, handle);
}
