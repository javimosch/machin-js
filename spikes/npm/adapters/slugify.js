import slugify from "npm:slugify@1.6.6";
export const slug = (s) => slugify(s, { lower: true, strict: true });
