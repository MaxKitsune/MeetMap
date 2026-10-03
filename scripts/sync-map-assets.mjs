import { mkdir, copyFile } from "node:fs/promises";
await mkdir("public/maplibre", { recursive: true });
for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"])
  await copyFile(
    "node_modules/maplibre-gl/dist/" + name,
    "public/maplibre/" + name,
  );
