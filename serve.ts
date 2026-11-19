import { createReadStream, realpathSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(fileURLToPath(new URL('./app', import.meta.url)));
const flag = process.argv.indexOf('--port', 2);
const choice = flag < 0 ? 8080 : Number(process.argv[flag + 1]);
const port = Number.isInteger(choice) && choice > 0 && choice <= 65535 ? choice : 8080;
const mime = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
]);

createServer((request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  let path;
  try {
    path = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }
  const candidate = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
  if (!candidate.startsWith(root + sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const file = realpathSync(candidate);
    if (!file.startsWith(root + sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const info = statSync(file);
    if (!info.isFile()) throw new Error('Expected a file');
    response.writeHead(200, {
      'Content-Type': mime.get(extname(file).toLowerCase()) ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
    });
    if (request.method === 'HEAD') response.end();
    else createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log('http://localhost:' + port));
