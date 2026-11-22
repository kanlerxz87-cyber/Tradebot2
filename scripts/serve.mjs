import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve(process.env.SERVE_DIST ? "dist" : ".");
http
  .createServer(async (req, res) => {
    try {
      const path = resolve(
        root,
        "." + decodeURIComponent(new URL(req.url, "http://local").pathname),
      );
      if (!path.startsWith(root + "/") && path !== root) throw Error();
      const target = path === root ? root + "/index.html" : path;
      const mime = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".md": "text/plain",
      };
      res.setHeader("Content-Type", mime[extname(target)] || "text/plain");
      res.setHeader("Cache-Control", "no-cache");
      res.end(await readFile(target));
    } catch {
      res.statusCode = 404;
      res.end("Not found");
    }
  })
  .listen(4173, "0.0.0.0", () => console.log("Dashboard listening on :4173"));
