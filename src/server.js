/**
 * Start the todo server.
 * @returns {void}
 */
function main() {
  //why: the arrow is required — machin functions aren't values, so handle is wrapped.
  //     8080 is fixed on purpose — one obvious default beats a config system for a pilot.
  serve(8080, (req) => handle(req));
}
