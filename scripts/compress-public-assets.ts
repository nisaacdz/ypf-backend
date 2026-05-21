/**
 * One-shot script — re-encode every oversized WebP in the public site's
 * `src/assets` directory in place.
 *
 * Settings:
 *  - max width 1920px (hero size; bigger doesn't help on any real display)
 *  - quality 70 (visually transparent on photos)
 *  - effort 6 (slower encode, smaller output — worth it for assets)
 *
 * Re-runnable: skips files already under the threshold.
 */
import path from "path";
import { promises as fs } from "fs";
import sharp from "sharp";

const ASSETS_ROOT = path.resolve(
  __dirname,
  "..",
  "..",
  "ypf-africa",
  "src",
  "assets",
);
const MAX_WIDTH = 1920;
const QUALITY = 70;
const THRESHOLD_BYTES = 300 * 1024;

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, out);
    else if (entry.isFile() && full.endsWith(".webp")) out.push(full);
  }
  return out;
}

async function main() {
  const files = await walk(ASSETS_ROOT);
  const targets: string[] = [];
  for (const f of files) {
    const stat = await fs.stat(f);
    if (stat.size > THRESHOLD_BYTES) targets.push(f);
  }
  if (targets.length === 0) {
    console.log("Nothing to compress — all WebPs already within budget.");
    return;
  }

  let savedBytes = 0;
  for (const f of targets) {
    const before = (await fs.stat(f)).size;
    const buf = await sharp(f)
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 6 })
      .toBuffer();
    if (buf.length < before) {
      await fs.writeFile(f, buf);
      const after = buf.length;
      savedBytes += before - after;
      console.log(
        `  ${path.relative(ASSETS_ROOT, f).padEnd(36)}  ` +
          `${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`,
      );
    } else {
      console.log(
        `  ${path.relative(ASSETS_ROOT, f).padEnd(36)}  (skipped — re-encode larger)`,
      );
    }
  }
  console.log(`\nSaved ${(savedBytes / 1024 / 1024).toFixed(2)} MB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
