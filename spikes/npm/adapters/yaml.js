import YAML from "npm:yaml@2.7.0";
export const parse = (s) => YAML.parse(s);
export const dump = (v) => YAML.stringify(v);
