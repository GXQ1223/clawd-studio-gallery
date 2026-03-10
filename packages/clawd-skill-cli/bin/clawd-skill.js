#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const REGISTRY_URL = "https://raw.githubusercontent.com/GXQ1223/clawd-studio-gallery/main/registry.json";

async function loadRegistry() {
  // Try local file first
  const localPath = path.resolve(process.cwd(), "registry.json");
  if (fs.existsSync(localPath)) {
    return JSON.parse(fs.readFileSync(localPath, "utf8"));
  }
  // Fallback to remote
  const res = await fetch(REGISTRY_URL);
  if (!res.ok) throw new Error(`Failed to fetch registry: ${res.status}`);
  return res.json();
}

async function list() {
  const reg = await loadRegistry();
  console.log(`\n  Clawd Studio Skills (${reg.skills.length} available)\n`);
  for (const s of reg.skills) {
    console.log(`  ${s.slug.padEnd(20)} ${s.name.padEnd(25)} ${s.disciplines.join(", ")}`);
  }
  console.log();
}

async function search(query) {
  const reg = await loadRegistry();
  const q = query.toLowerCase();
  const matches = reg.skills.filter(
    (s) => s.slug.includes(q) || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.disciplines.some((d) => d.includes(q))
  );
  if (matches.length === 0) { console.log(`\n  No skills matching "${query}"\n`); return; }
  console.log(`\n  ${matches.length} skill(s) matching "${query}":\n`);
  for (const s of matches) {
    console.log(`  ${s.slug.padEnd(20)} ${s.name}`);
    console.log(`  ${"".padEnd(20)} ${s.description}`);
    console.log();
  }
}

async function install(slug) {
  const reg = await loadRegistry();
  const skill = reg.skills.find((s) => s.slug === slug);
  if (!skill) { console.error(`  Skill "${slug}" not found in registry.`); process.exit(1); }
  console.log(`\n  To add "${skill.name}" to your project:\n`);
  console.log(`  1. Copy src/skills/${slug}/ from the Clawd Studio repository`);
  console.log(`  2. Ensure the skill is registered in your project_skills table`);
  console.log(`  3. The skill will be auto-discovered on next app load\n`);
}

const [,, cmd, ...args] = process.argv;
switch (cmd) {
  case "list": list().catch(console.error); break;
  case "search": search(args.join(" ")).catch(console.error); break;
  case "install": install(args[0]).catch(console.error); break;
  default:
    console.log("\n  Usage: clawd-skill <command>\n");
    console.log("  Commands:");
    console.log("    list              List all available skills");
    console.log("    search <query>    Search skills by name/description");
    console.log("    install <slug>    Install a skill\n");
}
