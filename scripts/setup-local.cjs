require('dotenv').config({ quiet: true });
const { NestFactory } = require('@nestjs/core');
const { getConnectionToken } = require('@nestjs/mongoose');
const { AppModule } = require('../dist/app.module');
const { CacheService } = require('../dist/infrastructure/cache/cache.service');
const { ObjectStorage } = require('../dist/infrastructure/storage/object-storage');
const argon2 = require('argon2');
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const connection = app.get(getConnectionToken());
    for (const model of Object.values(connection.models)) await model.createIndexes();
    await app.get(ObjectStorage).ensureBucket();
    await app.get(CacheService).client.ping();
    const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD || '';
    if (email && password) {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 12 || password.length > 128) throw new Error('Invalid ADMIN_EMAIL or ADMIN_PASSWORD');
      if (await connection.models.User.exists({ email })) console.log('Local admin account already exists; left unchanged.');
      else {
        await connection.models.User.create({ name: process.env.ADMIN_NAME || 'Administrator', email, passwordHash: await argon2.hash(password, { type: argon2.argon2id }), role: 'superadmin', active: true });
        console.log('Local admin created; credentials are in .env (ADMIN_EMAIL / ADMIN_PASSWORD).');
      }
    }
    console.log('MongoDB indexes, Redis connection, and MinIO bucket are ready.');
  } finally { await app.close(); }
}
main().catch(() => { console.error('Local setup failed; check service availability and environment configuration.'); process.exitCode = 1; });
