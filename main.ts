// Vice Coast Cover Studio — entry program.
//
// Copies app/ and screenshots/ from this repository into the output
// folder and writes the dossier buildDossier returns as dossier.json.
// Node 22+, standard library only. Deterministic: the same input
// always produces the same bytes.

import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";

mkdirSync(outDir, { recursive: true });
cpSync(join(here, "app"), join(outDir, "app"), { recursive: true });

const shotsDir = join(outDir, "screenshots");
mkdirSync(shotsDir, { recursive: true });
const sourceShots = join(here, "screenshots");
if (existsSync(sourceShots)) {
  cpSync(sourceShots, shotsDir, { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
});

writeFileSync(join(outDir, "dossier.json"), dossier);
