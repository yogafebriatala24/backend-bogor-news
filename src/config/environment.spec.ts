import { validateEnvironment } from './environment';
describe('environment validation', () => {
  const valid = {
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    MINIO_ACCESS_KEY: 'test',
    MINIO_SECRET_KEY: 'test',
  };
  it('defaults to requested local services', () => {
    const env = validateEnvironment(valid);
    expect(env.MONGODB_URI).toContain('/db-news');
    expect(env.MINIO_BUCKET).toBe('db-news');
    expect(env.MINIO_PORT).toBe(49000);
  });
  it('rejects weak secrets', () =>
    expect(() =>
      validateEnvironment({ ...valid, JWT_ACCESS_SECRET: 'weak' }),
    ).toThrow());
  it('rejects invalid ports', () =>
    expect(() => validateEnvironment({ ...valid, PORT: 'abc' })).toThrow());
  it('rejects wildcard CORS', () =>
    expect(() =>
      validateEnvironment({ ...valid, CORS_ORIGINS: '*' }),
    ).toThrow());
});
