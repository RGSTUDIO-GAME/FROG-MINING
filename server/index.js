import Fastify from 'fastify';
import cors from '@fastify/cors';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/auth.js';
import scoreRoutes from './routes/score.js';
import leaderboardRoutes from './routes/leaderboard.js';
import autominingRoutes from './routes/automining.js';
import mailRoutes from './routes/mail.js';
import diamondRoutes from './routes/diamond.js';
import db from './db/database.js';
import { initBackup, backupNow, getBackupStatus } from './services/backup.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

const fastify = Fastify({
  logger: {
    level: 'info',
  },
});

// CORS — allow frontend
await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
});

// Health check
fastify.get('/api/health', async () => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  version: '0.1.0',
}));

// Backup status
fastify.get('/api/admin/backup/status', async () => ({
  status: 'success',
  data: getBackupStatus(),
}));

// Manual backup trigger
fastify.post('/api/admin/backup', async (request, reply) => {
  const result = await backupNow(true);
  if (!result.success) {
    return reply.code(500).send({ status: 'error', message: result.error });
  }
  return reply.send({ status: 'success', message: 'Backup selesai', data: result });
});

// Register routes
await fastify.register(authRoutes);
await fastify.register(scoreRoutes);
await fastify.register(leaderboardRoutes);
await fastify.register(autominingRoutes);
await fastify.register(mailRoutes);
await fastify.register(diamondRoutes);

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: PORT, host: HOST });
    console.log('🐸 Frog Mining Server running on port ' + PORT);
    initBackup(db);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
