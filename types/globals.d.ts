// machin's number names for JSDoc, and the only JavaScript global the subset adds to the standard ones.
//why: `int` and `float` are both `number` to the checker — it cannot tell them apart.
type int = number;
type float = number;
declare const console: { log(...args: unknown[]): void };
