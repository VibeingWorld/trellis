import process from "node:process";
import { createFirstAdmin, hasAdmin } from "../src/lib/auth";

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}

function readSecret(label: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== "function") {
      reject(new Error("Run this command in an interactive VPS terminal so the password can be entered securely."));
      return;
    }
    let value = "";
    const finish = (error?: Error) => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error); else resolve(value);
    };
    const onData = (chunk: Buffer | string) => {
      for (const character of String(chunk)) {
        if (character === "\u0003") { finish(new Error("Cancelled.")); return; }
        if (character === "\r" || character === "\n") { finish(); return; }
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " ") value += character;
      }
    };
    process.stdout.write(label);
    process.stdin.setEncoding("utf8");
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

async function main() {
  const email = argument("email");
  const name = argument("name");
  if (!email || !name) throw new Error('Usage: npm run admin:create -- --email you@example.com --name "Your Name"');
  if (hasAdmin()) throw new Error("An administrator already exists. Manage additional accounts from Cove.");
  const password = await readSecret("Password (12+ characters): ");
  const confirmation = await readSecret("Confirm password: ");
  if (password !== confirmation) throw new Error("Passwords do not match.");
  const admin = await createFirstAdmin({ email, name, password });
  console.log(`Administrator created for ${admin.email}. You can now sign in from the web.`);
}

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
