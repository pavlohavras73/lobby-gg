const fs = require("fs");
const path = require("path");
const vm = require("vm");

function extractObject(src, startIdx) {
  let depth = 0, inStr = null, escape = false, start = -1;
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (inStr) { if (ch === inStr) inStr = null; continue; }
    if (ch === "\"" || ch === "'" || ch === "`") { inStr = ch; continue; }
    if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}") { depth--; if (depth === 0) return src.substring(start, i + 1); }
  }
  return null;
}

const dir = path.join(__dirname, "../static");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".html") && f !== "admin.html" && f !== "login.html" && f !== "offline.html").sort();

let totalErrors = 0;
let okCount = 0;

for (const f of files) {
  const html = fs.readFileSync(path.join(dir, f), "utf8");
  const errors = [];

  // 1. Langbar check (except snake.html which has no langbar in HTML)
  if (f !== "snake.html") {
    const langbarMatch = html.match(/id=["']langbar["'][^>]*>([\s\S]*?)<\/div>/);
    if (!langbarMatch) {
      errors.push("Missing #langbar div");
    } else if (!/data-lang=["']de["']/.test(langbarMatch[1])) {
      errors.push("Missing DEU button in #langbar");
    }
  }

  // 2. Syntax check for inline scripts
  const scriptRegex = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let scriptIdx = 0;
  while ((match = scriptRegex.exec(html)) !== null) {
    scriptIdx++;
    try {
      new vm.Script(match[1], { filename: `${f}:script${scriptIdx}` });
    } catch (e) {
      errors.push(`Syntax error in script ${scriptIdx}: ${e.message}`);
    }
  }

  // 3. UI dictionary check
  const m = html.match(/(?:const|var|let)\s+(UI|I18N)\s*=\s*/);
  if (!m) {
    errors.push("Missing UI/I18N dict");
  } else {
    try {
      const objStr = extractObject(html, m.index);
      const dict = eval("(" + objStr + ")");
      if (!dict.de) {
        errors.push("Missing \"de\" in " + m[1]);
      } else {
        const enKeys = Object.keys(dict.en || {}).sort();
        const deKeys = Object.keys(dict.de || {}).sort();
        const missingInDe = enKeys.filter(k => !deKeys.includes(k));
        const extraInDe = deKeys.filter(k => !enKeys.includes(k));
        if (missingInDe.length) errors.push("Missing in de: " + missingInDe.join(", "));
        if (extraInDe.length) errors.push("Extra in de: " + extraInDe.join(", "));
      }
    } catch (e) {
      errors.push("Error evaluating UI dict: " + e.message);
    }
  }

  // 4. GT dictionary check
  const gm = html.match(/(?:const|var|let)\s+GT\s*=\s*/);
  if (gm) {
    try {
      const gtStr = extractObject(html, gm.index);
      const gt = eval("(" + gtStr + ")");
      const missingGt = [];
      for (const k of Object.keys(gt)) {
        if (!gt[k].de || typeof gt[k].de !== "string") missingGt.push(k);
      }
      if (missingGt.length) errors.push(`Missing de in ${missingGt.length} GT entries`);
    } catch (e) {
      errors.push("Error evaluating GT dict: " + e.message);
    }
  }

  if (errors.length) {
    totalErrors += errors.length;
    console.log(`❌ ${f.padEnd(20)}: ${errors.join("; ")}`);
  } else {
    okCount++;
    console.log(`✅ ${f.padEnd(20)}`);
  }
}

console.log(`\nResults: ${okCount}/${files.length} OK. Total errors: ${totalErrors}`);
process.exit(totalErrors === 0 ? 0 : 1);
