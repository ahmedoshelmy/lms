// Serves a built app for the end-to-end tests: files as they are, and
// index.html for any route, as nginx does in production. A prebuilt bundle,
// rather than `ng serve`, so a test never meets the dev server mid-rebuild.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const [root, port] = [resolve(process.argv[2]), Number(process.argv[3] ?? 4300)];
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = join(root, path);
  // Nothing outside the build folder.
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if (!extname(path)) throw new Error('a route');
    res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch {
    if (extname(path)) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(await readFile(join(root, 'index.html')));
  }
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on ${port}`));
