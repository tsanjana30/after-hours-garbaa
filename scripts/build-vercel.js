const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
fs.cpSync(path.join(root, "frontend"), path.join(root, "public"), {
    recursive: true,
    force: true
});
console.log("Copied frontend assets to Vercel public directory.");
