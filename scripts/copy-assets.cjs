const { cpSync } = require("node:fs");
const path = require("node:path");
for (const directory of ["public", "views"]) {
  cpSync(
    path.join(__dirname, "..", "src", directory),
    path.join(__dirname, "..", "dist", directory),
    { recursive: true },
  );
}
