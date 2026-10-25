import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('out');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.txt':'text/plain'};
http.createServer(async (req,res) => {
  try {
    let name = decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/chronos(?=\/|$)/,'');
    let file = path.resolve(root, '.' + name);
    if (!file.startsWith(root + path.sep) && file !== root) throw new Error('path');
    if ((await stat(file)).isDirectory()) file = path.join(file,'index.html');
    res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
}).listen(4173,'127.0.0.1');
