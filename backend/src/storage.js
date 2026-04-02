import fs from "node:fs/promises";
import path from "node:path";

const dataDir = path.join(process.cwd(), "src", "data");

async function readJson(fileName, fallback) {
  const p = path.join(dataDir, fileName);
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    if (e?.code === "ENOENT") return fallback;
    throw e;
  }
}

async function writeJsonAtomic(fileName, data) {
  const p = path.join(dataDir, fileName);
  const tmp = p + ".tmp";
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, p);
}

export async function getRequests() {
  const db = await readJson("requests.json", { requests: [] });
  return db.requests ?? [];
}

export async function saveRequests(requests) {
  await writeJsonAtomic("requests.json", { requests });
}

export async function getDrivers() {
  const db = await readJson("drivers.json", { drivers: [] });
  return db.drivers ?? [];
}

export async function saveDrivers(drivers) {
  await writeJsonAtomic("drivers.json", { drivers });
}

