import { access, cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(scriptPath), "..");

export async function prepareDeployment(root = projectRoot) {
  const standalone = path.join(root, ".next", "standalone");
  try {
    await access(path.join(standalone, "server.js"));
    await access(path.join(root, ".next", "static"));
  } catch {
    throw new Error(
      "Standalone build is missing. Enable output: 'standalone' and run next build first.",
    );
  }

  const staticTarget = path.join(standalone, ".next", "static");
  await rm(staticTarget, { recursive: true, force: true });
  await cp(path.join(root, ".next", "static"), staticTarget, {
    recursive: true,
  });

  const publicSource = path.join(root, "public");
  const publicTarget = path.join(standalone, "public");
  await rm(publicTarget, { recursive: true, force: true });
  try {
    await access(publicSource);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  await cp(publicSource, publicTarget, { recursive: true });
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  await prepareDeployment();
  console.log("Standalone deployment prepared with static and public assets.");
}
