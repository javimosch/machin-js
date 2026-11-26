// not a library: the web and Node features that libraries commonly lean on
export const intlNumber = () => new Intl.NumberFormat("de-DE").format(1234567.891);
export const localeDate = () => new Date(Date.UTC(2026, 0, 5)).toLocaleDateString("fr-FR", { timeZone: "UTC", month: "long" });
export const localeUpper = () => "istanbul".toLocaleUpperCase("tr-TR");
export const textEncoder = () => new TextEncoder().encode("hé").length;
export const url = () => new URL("https://a.dev/x?y=1").searchParams.get("y");
export const random = () => typeof crypto.randomUUID();
export const clone = () => structuredClone({ a: [1] }).a.length;
export const base64 = () => btoa("hi");
export const timer = () => typeof setTimeout;
export const regexUnicode = () => "café ☃".match(/\p{L}+/gu);
export const bigint = () => String(2n ** 70n);
export const later = async () => 1;
