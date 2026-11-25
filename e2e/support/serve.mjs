// Serves a built app for the end-to-end tests: files as they are, and
// index.html for any route, as nginx does in production. A prebuilt bundle,
// rather than `ng serve`, so a test never meets the dev server mid-rebuild.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';

const [root, port] = [resolve(process.argv[2]), Number(process.argv[3] ?? 4300)];

// The production headers (nginx-security-headers.conf), when given: every
// response carries them, so the tests run under the real Content-Security-Policy.
const headers = process.argv[4]
  ? [
      ...readFileSync(process.argv[4], 'utf8').matchAll(
        /^add_header\s+(\S+)\s+(?:"([^"]*)"|'([^']*)')/gm
      ),
    ].map(([, name, double, single]) => [name, double ?? single])
  : [];
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

async function answer(req, res) {
  for (const [name, value] of headers) res.setHeader(name, value);
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = join(root, path);
  // Nothing outside the build folder.
  if (file !== root && !file.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  if (extname(path)) {
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
    return;
  }
  // A route: the app answers it.
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(await readFile(join(root, 'index.html')));
}

createServer(async (req, res) => {
  // Whatever happens, an answer: an unhandled rejection would end the server,
  // and every test after it, over one malformed address.
  try {
    await answer(req, res);
  } catch {
    if (!res.headersSent) res.writeHead(400);
    res.end();
  }
}).listen(port, '127.0.0.1', () => console.log(`serving ${root} on ${port}`));
