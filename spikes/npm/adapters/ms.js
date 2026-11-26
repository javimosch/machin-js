import ms from "npm:ms@2.1.3";
export const toMs = (s) => ms(s);
export const human = (n) => ms(n, { long: true });
