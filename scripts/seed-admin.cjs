// Explicit bootstrap command; never creates accounts during API startup.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const argon2 = require('argon2');
async function main() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = process.env.ADMIN_NAME || 'Administrator';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || password.length < 12 || password.length > 128) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (12–128 characters) in .env before running this command');
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    const users = mongoose.connection.collection('users');
    await users.createIndex({ email: 1 }, { unique: true });
    if (await users.findOne({ email })) throw new Error('Account already exists; bootstrap will not overwrite it');
    await users.insertOne({ name, email, role: 'superadmin', active: true, passwordHash: await argon2.hash(password, { type: argon2.argon2id }), createdAt: new Date(), updatedAt: new Date() });
    console.log('Superadmin created successfully. Use POST /api/v1/auth/login.');
  } finally { await mongoose.disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
