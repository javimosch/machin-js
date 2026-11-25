// Type-check the user's plain .js with the TypeScript checker, which reads their JSDoc.
//why: no .ts files and no TS syntax — JavaScript stays the source; the checker only reads it.
import ts from "npm:typescript@5.7.3";
import { fromFileUrl } from "jsr:@std/path@1";
import type { Diag } from "./transpile.ts";

const types = fromFileUrl(new URL("../types/", import.meta.url));

/** Create a checker program over these files, with machin's modules mapped to their typings. */
export function program(files: string[]): ts.Program {
  return ts.createProgram([...files, `${types}globals.d.ts`], {
    allowJs: true, checkJs: true, noEmit: true, strict: true,
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    //why: no DOM or Node typings — a name that doesn't exist natively must not type-check.
    lib: ["lib.es2022.d.ts"], types: [], baseUrl: types,
    paths: {
      machin: [`${types}machin.d.ts`],
      "machin/web": [`${types}machweb.d.ts`],
      "machin/desktop": [`${types}desktop.d.ts`],
    },
  });
}

/** Every type error in the program, as JS-TYPE001 diagnostics. */
export function typeErrors(p: ts.Program): Diag[] {
  return ts.getPreEmitDiagnostics(p).map((d) => ({
    code: "JS-TYPE001",
    msg: `${ts.flattenDiagnosticMessageText(d.messageText, " ")} (TS${d.code})`,
    file: d.file?.fileName ?? "(typings)",
    line: d.file ? d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1 : 0,
  }));
}
