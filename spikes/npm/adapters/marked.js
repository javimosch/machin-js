import { marked } from "npm:marked@15.0.6";
export const html = (md) => marked.parse(md);
