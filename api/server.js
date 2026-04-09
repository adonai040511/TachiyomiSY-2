import express from 'express';
import handler from './compress.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';

// Inicializar caché al cargar el módulo
import('./compress.js').then(({ initCache }) => {
    initCache().catch(console.error);
}).catch(console.error);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 7860;

// Configuración optimizada para Vercel serverless
const CONFIG = {
    port: PORT,
    host: '0.0.0.0', // Vercel requiere binding a 0.0.0.0
    maxConcurrentRequests: 1, // Vercel maneja concurrencia con functions
    requestTimeout: 20000, // 20 segundos timeout para Vercel
    keepAliveTimeout: 20000,
    headersTimeout: 21000
};

// Middleware para logging básico
app.use((req, res, next) => {
    const start = Date.now();
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
    });

    next();
});

// Servir archivos estáticos con caché agresivo
app.use(express.static(join(__dirname, '../public'), {
    maxAge: '1d',
    etag: true
}));

// Ruta de compresión con timeout para Vercel
app.get('/api/compress', async (req, res) => {
    // Timeouts configurados para Vercel
    req.setTimeout(CONFIG.requestTimeout);
    res.setTimeout(CONFIG.requestTimeout);

    await handler(req, res);
});

// Health check para monitoring
app.get('/health', (req, res) => {
    const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: os.cpus().length,
        platform: process.platform,
        version: process.version
    };
    res.json(health);
});

// Endpoint de métricas para monitoreo
app.get('/metrics', (req, res) => {
    const metrics = {
        active_requests: 0, // Podrías implementar un contador
        total_requests: 0,
        memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        uptime_seconds: Math.round(process.uptime()),
        node_version: process.version
    };
    res.json(metrics);
});

// Manejo de errores global optimizado
app.use((err, req, res, next) => {
    console.error(`[${new Date().toISOString()}] Error:`, err);

    if (!res.headersSent) {
        res.status(500).json({
            error: 'Internal Server Error',
            reason: err.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Configuración del servidor para HF Spaces
const server = app.listen(CONFIG.port, CONFIG.host, () => {
    console.log(`🚀 Tachiyomi Compression Service`);
    console.log(`📍 Running on: http://${CONFIG.host}:${CONFIG.port}`);
    console.log(`💻 CPUs available: ${os.cpus().length}`);
    console.log(`🧠 Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB total`);
    console.log(`⏰ Vercel serverless function optimized`);
});

// Configurar timeouts del servidor
server.keepAliveTimeout = CONFIG.keepAliveTimeout;
server.headersTimeout = CONFIG.headersTimeout;

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
        process.exit(0);
    });
});

