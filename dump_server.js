const http = require('http');

const server = http.createServer((req, res) => {
    console.log(`\n\n[REQUEST] ${req.method} ${req.url}`);
    console.log('[HEADERS]', req.headers);

    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
        console.log('[BODY]', body);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: "invalid_grant" }));
    });
});

server.listen(8080, () => console.log('Listening on 8080...'));
