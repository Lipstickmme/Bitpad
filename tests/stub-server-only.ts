import Module from "node:module";
// `server-only` throws outside React Server Components; stub it for unit tests.
const M = Module as unknown as { _load: (req: string, ...rest: unknown[]) => unknown };
const orig = M._load;
M._load = function (req: string, ...rest: unknown[]) {
  if (req === "server-only") return {};
  return orig.call(this, req, ...rest);
};
