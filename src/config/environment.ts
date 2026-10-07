export function validateEnvironment(env: Record<string, unknown>) {
  const config = {
    NODE_ENV: 'development',
    APP_HOST: '127.0.0.1',
    PORT: 3001,
    MONGODB_URI: 'mongodb://127.0.0.1:27017/db-news',
    REDIS_CACHE_URL: 'redis://127.0.0.1:6379/0',
    REDIS_QUEUE_URL: 'redis://127.0.0.1:6379/1',
    REDIS_PREFIX: 'media:development:db-news',
    CORS_ORIGINS: 'http://localhost:3000,http://127.0.0.1:3000',
    MINIO_ENDPOINT: '127.0.0.1',
    MINIO_PORT: 49000,
    MINIO_USE_SSL: 'false',
    MINIO_BUCKET: 'db-news',
    MAX_UPLOAD_BYTES: 10485760,
    ...env,
  };
  for (const key of [
    'JWT_ACCESS_SECRET',
    'MINIO_ACCESS_KEY',
    'MINIO_SECRET_KEY',
  ]) {
    if (typeof config[key] !== 'string' || !config[key])
      throw new Error(`Missing environment variable: ${key}`);
  }
  if (String(config['JWT_ACCESS_SECRET']).length < 32)
    throw new Error('JWT_ACCESS_SECRET must have at least 32 characters');
  for (const key of ['PORT', 'MINIO_PORT', 'MAX_UPLOAD_BYTES']) {
    const value = Number(config[key]);
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      (key !== 'MAX_UPLOAD_BYTES' && value > 65535)
    )
      throw new Error(`Invalid environment variable: ${key}`);
    config[key] = value;
  }
  if (!['development', 'test', 'production'].includes(String(config.NODE_ENV)))
    throw new Error('Invalid NODE_ENV');
  if (!['true', 'false'].includes(String(config.MINIO_USE_SSL)))
    throw new Error('MINIO_USE_SSL must be true or false');
  if (!/^mongodb(\+srv)?:\/\//.test(String(config.MONGODB_URI)))
    throw new Error('Invalid MONGODB_URI');
  for (const key of ['REDIS_CACHE_URL', 'REDIS_QUEUE_URL']) {
    if (!['redis:', 'rediss:'].includes(new URL(String(config[key])).protocol))
      throw new Error(`Invalid ${key}`);
  }
  const origins = String(config.CORS_ORIGINS)
    .split(',')
    .map((s) => s.trim());
  if (
    !origins.length ||
    origins.some((origin) => !/^https?:\/\/[^/]+$/.test(origin))
  )
    throw new Error('CORS_ORIGINS must contain explicit HTTP origins');
  return config;
}
