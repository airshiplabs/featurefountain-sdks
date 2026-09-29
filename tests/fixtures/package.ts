import { execFile } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const source = fileURLToPath(new URL("../../", import.meta.url));

export interface CleanPackage {
  bundle: string;
  files: string[];
  fileList: string;
  contents: string;
  manifest: { name?: string; license?: string };
  close(): Promise<void>;
}

export async function buildCleanCheckout(
  secrets: Record<string, string>,
): Promise<CleanPackage> {
  const temporary = await mkdtemp(
    join(tmpdir(), "featurefountain-widget-package-"),
  );
  const checkout = join(temporary, "checkout");
  const artifacts = join(temporary, "artifacts");
  const extracted = join(temporary, "extracted");
  try {
    await cp(source, checkout, {
      recursive: true,
      filter: (path) =>
        ![
          "node_modules",
          ".git",
          "dist",
          "test-results",
          "playwright-report",
          "coverage",
        ].includes(basename(path)),
    });
    await mkdir(artifacts);
    await mkdir(extracted);
    await writeFile(
      join(checkout, ".env.local"),
      Object.entries(secrets)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n"),
    );
    const options = {
      cwd: checkout,
      env: { ...process.env, ...secrets, CI: "1", TZ: "UTC" },
    };
    await exec("pnpm", ["install", "--offline", "--frozen-lockfile"], options);
    await exec("pnpm", ["build"], options);
    await exec("pnpm", ["pack", "--pack-destination", artifacts], options);
    const archives = (await readdir(artifacts)).filter((name) =>
      name.endsWith(".tgz"),
    );
    if (archives.length !== 1)
      throw new Error(`Expected one package archive, found ${archives.length}`);
    const archive = join(artifacts, archives[0]);
    const listing = await exec("tar", ["-tzf", archive]);
    const files = listing.stdout
      .trim()
      .split(/\r?\n/)
      .filter((name) => !name.endsWith("/"))
      .sort();
    await exec("tar", ["-xzf", archive, "-C", extracted]);
    const contents = (
      await Promise.all(
        files.map((name) => readFile(join(extracted, name), "utf8")),
      )
    ).join("\n");
    return {
      bundle: await readFile(join(checkout, "dist/index.js"), "utf8"),
      files,
      fileList: files.join("\n"),
      contents,
      manifest: JSON.parse(
        await readFile(join(extracted, "package/package.json"), "utf8"),
      ),
      close: () => rm(temporary, { recursive: true, force: true }),
    };
  } catch (error) {
    await rm(temporary, { recursive: true, force: true });
    throw error;
  }
}
