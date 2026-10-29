// Tests only: lets `node --test` load app modules that import "./plan" without the .js extension (Next.js style).
import { register } from "node:module";
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx); }
  catch (e) { if (e.code === "ERR_MODULE_NOT_FOUND" && /^\\.\\.?\\//.test(spec) && !/\\.m?js$/.test(spec)) return next(spec + ".js", ctx); throw e; }
}`));
