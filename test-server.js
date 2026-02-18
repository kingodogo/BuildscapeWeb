/**
 * Simple local test server for BuildScape API
 * Run with: node test-server.js
 */

import { createServer } from 'http';
import { parse } from 'url';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3000;

// Import the API handlers
async function loadHandler(path) {
  try {
    const module = await import(path);
    return module.handler || module.default;
  } catch (error) {
    console.error(`Failed to load handler ${path}:`, error.message);
    return null;
  }
}

const handlers = {};

async function initHandlers() {
  console.log('Loading API handlers...');
  
  const apiHandlers = [
    { path: '/api/minecraft', file: './netlify/functions/api-minecraft.ts' },
    { path: '/api/redeem', file: './netlify/functions/api-redeem.ts' },
    { path: '/api/cosmetics', file: './netlify/functions/api-cosmetics.ts' },
  ];

  for (const { path, file } of apiHandlers) {
    const handler = await loadHandler(join(__dirname, file));
    if (handler) {
      handlers[path] = handler;
      console.log(`✓ Loaded ${path}`);
    }
  }
}

async function handleRequest(req, res) {
  const parsedUrl = parse(req.url, true);
  const path = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Check if it's an API route
  if (handlers[path]) {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        // Create event object similar to Netlify Functions
        const event = {
          httpMethod: req.method,
          path: path,
          queryStringParameters: parsedUrl.query,
          headers: req.headers,
          body: body,
        };

        // Call the handler
        const result = await handlers[path](event, {});

        // Send response
        res.writeHead(result.statusCode || 200, {
          'Content-Type': 'application/json',
          ...result.headers,
        });
        res.end(result.body);
      } catch (error) {
        console.error('Handler error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  } else {
    // Not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

async function start() {
  await initHandlers();
  
  const server = createServer(handleRequest);
  
  server.listen(PORT, () => {
    console.log('');
    console.log(`🚀 BuildScape Test Server running at http://localhost:${PORT}`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  POST http://localhost:3000/api/minecraft');
    console.log('  POST http://localhost:3000/api/redeem');
    console.log('  POST http://localhost:3000/api/cosmetics');
    console.log('');
    console.log('Press Ctrl+C to stop');
  });
}

start().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
