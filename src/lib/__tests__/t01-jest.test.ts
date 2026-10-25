// §7 #1 — Jest + ts-jest wired, `npm test` script exists.
import pkg from "../../../package.json";
test("#1 npm test runs jest", () => {
  expect((pkg as { scripts: Record<string, string> }).scripts.test).toBe("jest");
});
