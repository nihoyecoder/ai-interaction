// Serves fixtures/ at http://127.0.0.1:5174 so the extension can be tested on
// local pages with known values. Run with `npm run fixtures`. Only reachable
// from this computer.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const root = resolve('fixtures');
const port = 5174;
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', `http://127.0.0.1:${port}`);
  const filePath = normalize(join(root, decodeURIComponent(pathname === '/' ? '/index.html' : pathname)));
  if (filePath !== root && !filePath.startsWith(root + sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const body = await readFile(filePath);
    response.writeHead(200, { 'content-type': contentTypes[extname(filePath)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Test pages: http://127.0.0.1:${port}/  (press Ctrl+C to stop)`);
});
