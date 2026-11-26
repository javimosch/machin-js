import { chunk, groupBy, sortBy, uniq } from "npm:lodash-es@4.17.21";
export const chunks = (xs, n) => chunk(xs, n);
export const grouped = (xs) => groupBy(xs, (s) => s.length);
export const tidy = (xs) => sortBy(uniq(xs));
