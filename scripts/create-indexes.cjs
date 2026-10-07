// Run npm run build first. Add indexes only; never drops existing indexes.
require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const schemas = [
  ['User', require('../dist/modules/users/user.schema').UserSchema, 'users'],
  ['Session', require('../dist/modules/auth/session.schema').SessionSchema, 'sessions'],
  ['Article', require('../dist/modules/articles/article.schema').ArticleSchema, 'articles'],
  ['Category', require('../dist/modules/taxonomy/taxonomy.schema').TaxonomySchema.clone(), 'categories'],
  ['Tag', require('../dist/modules/taxonomy/taxonomy.schema').TaxonomySchema.clone(), 'tags'],
  ['Media', require('../dist/modules/media/media.schema').MediaSchema, 'media'],
];
async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000, autoIndex: false });
    for (const [name, schema, collection] of schemas) { await mongoose.model(name, schema, collection).createIndexes(); console.log(`Indexes ready: ${collection}`); }
  } finally { await mongoose.disconnect(); }
}
main().catch(() => { console.error('Index creation failed; check database connectivity and duplicate data'); process.exitCode = 1; });
