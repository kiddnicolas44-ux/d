import express from "express";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROM = join(__dirname, "Prometheus-master");
const TOKEN = process.env.PROMETHEUS_TOKEN || "";
const PORT = Number(process.env.PORT || 8080);

const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/", (_q, r) => r.json({ ok: true }));

app.post("/obfuscate", async (req, res) => {
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`)
    return res.status(401).json({ error: "Unauthorized" });

  const { source, preset = "Medium" } = req.body || {};
  if (typeof source !== "string" || !source.trim())
    return res.status(400).json({ error: "source required" });
  if (!["Minify","Weak","Medium","Strong"].includes(preset))
    return res.status(400).json({ error: "bad preset" });

  const work = await mkdtemp(join(tmpdir(), "prom-"));
  const inPath = join(work, "input.lua");
  const outPath = join(work, "output.lua");
  try {
    await writeFile(inPath, source, "utf8");
    const driver = `
package.path = "./?.lua;./src/?.lua;" .. package.path
local Prometheus = require("src.prometheus")
local f = io.open([[${inPath}]], "r"); local src = f:read("*a"); f:close()
local cfg = require("src.presets").${preset}
local out = Prometheus.Pipeline:fromConfig(cfg):apply(src, "input.lua")
local o = io.open([[${outPath}]], "w"); o:write(out); o:close()
`;
    const driverPath = join(work, "driver.lua");
    await writeFile(driverPath, driver, "utf8");
    await new Promise((ok, bad) => {
      const p = spawn("lua5.4", [driverPath], { cwd: PROM });
      let err = ""; p.stderr.on("data", d => err += d);
      p.on("close", c => c === 0 ? ok() : bad(new Error(err || `exit ${c}`)));
    });
    res.json({ success: true, obfuscated: await readFile(outPath, "utf8") });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  } finally {
    rm(work, { recursive: true, force: true }).catch(() => {});
  }
});

app.listen(PORT, () => console.log(`prom-host :${PORT}`));
