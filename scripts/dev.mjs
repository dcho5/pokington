import { spawn } from "node:child_process";
import process from "node:process";

const PARTY_HEALTH_URL = "http://127.0.0.1:1999/parties/main/__control__/health";
const HEALTH_TIMEOUT_MS = 20_000;
const HEALTH_POLL_MS = 500;

let shuttingDown = false;
let nextProcess = null;

function prefixStream(stream, label, target = process.stdout) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    const lines = chunk.split(/\r?\n/);
    for (const line of lines) {
      if (!line) continue;
      target.write(`[${label}] ${line}\n`);
    }
  });
}

function terminate(child, signal = "SIGTERM") {
  if (!child || child.exitCode !== null) return;
  child.kill(signal);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPartyKit(partyProcess) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (partyProcess.exitCode !== null) {
      throw new Error("PartyKit exited before becoming healthy.");
    }

    try {
      const response = await fetch(PARTY_HEALTH_URL, { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        if (payload?.ok) return;
      }
    } catch {
      // Keep polling until timeout.
    }

    await sleep(HEALTH_POLL_MS);
  }

  throw new Error(`Timed out waiting for PartyKit healthcheck at ${PARTY_HEALTH_URL}`);
}

function shutdown(partyProcess, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  terminate(nextProcess);
  terminate(partyProcess);
  setTimeout(() => process.exit(code), 50);
}

const partyProcess = spawn("pnpm", ["-C", "apps/web", "party"], {
  stdio: ["ignore", "pipe", "pipe"],
  env: process.env,
});

prefixStream(partyProcess.stdout, "party");
prefixStream(partyProcess.stderr, "party", process.stderr);

partyProcess.on("exit", (code) => {
  if (shuttingDown) return;
  process.stderr.write(`[party] exited with code ${code ?? 1}\n`);
  shutdown(partyProcess, code ?? 1);
});

process.on("SIGINT", () => shutdown(partyProcess, 130));
process.on("SIGTERM", () => shutdown(partyProcess, 143));

try {
  await waitForPartyKit(partyProcess);
  process.stdout.write(`[dev] PartyKit healthy at ${PARTY_HEALTH_URL}\n`);
} catch (error) {
  process.stderr.write(`[dev] ${error instanceof Error ? error.message : "Failed to start PartyKit"}\n`);
  shutdown(partyProcess, 1);
}

if (!shuttingDown) {
  nextProcess = spawn("pnpm", ["-C", "apps/web", "dev"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
  });

  prefixStream(nextProcess.stdout, "next");
  prefixStream(nextProcess.stderr, "next", process.stderr);

  nextProcess.on("exit", (code) => {
    if (shuttingDown) return;
    process.stderr.write(`[next] exited with code ${code ?? 1}\n`);
    shutdown(partyProcess, code ?? 1);
  });
}
