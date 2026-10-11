import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
  access,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { prepareDeployment } from "./prepare-deployment.mjs";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "tradelyzer-package-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, ".next/standalone"), { recursive: true });
  await mkdir(path.join(root, ".next/static"), { recursive: true });
  await writeFile(path.join(root, ".next/standalone/server.js"), "server");
  await writeFile(path.join(root, ".next/static/app.js"), "asset");
  return root;
}

test("packages assets and replaces stale files without removing the server", async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, "public"));
  await writeFile(path.join(root, "public/logo.svg"), "logo");
  await prepareDeployment(root);
  await writeFile(
    path.join(root, ".next/standalone/.next/static/old.js"),
    "stale",
  );
  await writeFile(path.join(root, ".next/standalone/public/old.svg"), "stale");
  await prepareDeployment(root);
  assert.equal(
    await readFile(path.join(root, ".next/standalone/server.js"), "utf8"),
    "server",
  );
  assert.equal(
    await readFile(
      path.join(root, ".next/standalone/.next/static/app.js"),
      "utf8",
    ),
    "asset",
  );
  assert.equal(
    await readFile(path.join(root, ".next/standalone/public/logo.svg"), "utf8"),
    "logo",
  );
  await assert.rejects(
    access(path.join(root, ".next/standalone/.next/static/old.js")),
  );
  await assert.rejects(
    access(path.join(root, ".next/standalone/public/old.svg")),
  );
});

test("supports projects without a public directory", async (t) => {
  await prepareDeployment(await fixture(t));
});

test("rejects an incomplete standalone build before packaging", async (t) => {
  const root = await fixture(t);
  await rm(path.join(root, ".next/standalone/server.js"));
  await assert.rejects(prepareDeployment(root), /Standalone build is missing/);
});
