import { z } from "npm:zod@3.24.1";
const User = z.object({ name: z.string().min(1), age: z.number().int().positive(), email: z.string().email() });
export const check = (v) => { const r = User.safeParse(v); return r.success ? r.data : r.error.issues.map((i) => i.path.join(".") + ": " + i.message); };
