// §7 #13 — both version strings show 1.1.60.
import fs from "fs";
import path from "path";
import { APP_VERSION } from "@/lib/version";

test("#13 version is 1.1.60 everywhere", () => {
  expect(APP_VERSION).toBe("1.1.60");
  const root = path.join(__dirname, "../../..");
  const home = fs.readFileSync(path.join(root, "src/app/page.tsx"), "utf8");
  const settings = fs.readFileSync(path.join(root, "src/app/settings/page.tsx"), "utf8");
  expect(home).toMatch(/v\{APP_VERSION\}/);
  expect(settings).toMatch(/\{APP_VERSION\}/);
  expect(home + settings).not.toMatch(/1\.1\.5[678]/);
  expect(JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version).toBe("1.1.60");
});
