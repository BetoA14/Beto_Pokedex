// Use the tested Node 24 line, including its built-in SQLite and TypeScript support.
const [major, minor] = process.versions.node.split(".").map(Number);
if (major !== 24 || minor < 21) {
  throw new Error(`Use Node.js 24.21 or newer within the 24.x LTS line. Found ${process.version}.`);
}

try {
  const { DatabaseSync } = await import("node:sqlite");
  const database = new DatabaseSync(":memory:");
  database.close();
} catch (cause) {
  throw new Error("This Node.js installation must include node:sqlite. Install the official Node 24 LTS build.", { cause });
}
console.log(`Environment ready: Node ${process.versions.node}, SQLite available.`);
