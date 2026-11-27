// The gate's stand-in for the service linkbox notifies. It records each request, then answers
// 200, 500, closes without a reply, and finally says nothing at all.
const [port, log] = Deno.args;
let count = 0;
const held = [];
for await (const conn of Deno.listen({ hostname: "127.0.0.1", port: Number(port) })) {
  (async () => {
    const buffer = new Uint8Array(65536);
    const text = new TextDecoder().decode(buffer.subarray(0, (await conn.read(buffer)) ?? 0));
    if (text.startsWith("POST /in ")) {
      const [head, body] = text.split("\r\n\r\n");
      Deno.writeTextFileSync(log, `request ${head.split("\r\n")[0]}\nsignature ${/X-Signature: (\S+)/.exec(head)?.[1]}\nbody ${body}\n`, { append: true });
      count++;
    }
    const answers = ["200 OK", "500 Internal Server Error"];
    if (!text.startsWith("POST /in ") || count <= 2) {
      await conn.write(new TextEncoder().encode(`HTTP/1.1 ${answers[count - 1] ?? "200 OK"}\r\nContent-Length: 0\r\n\r\n`));
    } else if (count >= 4) {
      held.push(conn);
      return;
    }
    conn.close();
  })().catch(() => {});
}
