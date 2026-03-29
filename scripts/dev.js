const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const port = process.env.PORT || "4174";
const watchDirs = ["data", "scripts"];
const watchFiles = ["styles.css", "package.json", "vercel.json"];

let buildTimer = null;
let building = false;
let pendingBuild = false;

const runBuild = () => {
  if (building) {
    pendingBuild = true;
    return;
  }

  building = true;
  const child = spawn(process.execPath, [path.join(root, "scripts", "build.js")], {
    cwd: root,
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    building = false;

    if (code === 0) {
      console.log(`\n[dev] Build complete at ${new Date().toLocaleTimeString()}`);
    } else {
      console.log(`\n[dev] Build failed with exit code ${code}`);
    }

    if (pendingBuild) {
      pendingBuild = false;
      runBuild();
    }
  });
};

const scheduleBuild = (reason) => {
  if (buildTimer) clearTimeout(buildTimer);
  buildTimer = setTimeout(() => {
    console.log(`\n[dev] Change detected in ${reason}. Rebuilding...`);
    runBuild();
  }, 120);
};

const startWatcher = (targetPath) => {
  try {
    fs.watch(targetPath, { recursive: true }, (_eventType, filename) => {
      const reason = filename ? path.join(path.basename(targetPath), filename) : targetPath;
      scheduleBuild(reason);
    });
    console.log(`[dev] Watching ${path.relative(root, targetPath) || targetPath}`);
  } catch (error) {
    console.warn(`[dev] Could not watch ${targetPath}: ${error.message}`);
  }
};

console.log(`[dev] Starting brat.gg dev server on http://localhost:${port}`);
runBuild();

[...watchDirs.map((dir) => path.join(root, dir)), ...watchFiles.map((file) => path.join(root, file))].forEach(startWatcher);

const server = spawn(process.execPath, [path.join(root, "scripts", "secure-serve.js")], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PORT: port },
});

let shuttingDown = false;

const shutdown = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("\n[dev] Shutting down...");
  server.kill("SIGTERM");
  process.exit(0);
};

server.on("exit", (code) => {
  if (shuttingDown) return;

  if (code === 0 || code === null) {
    console.log("[dev] Server stopped.");
  } else {
    console.log(`[dev] Server exited with code ${code}. Is port ${port} already in use?`);
    process.exit(code);
  }
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
