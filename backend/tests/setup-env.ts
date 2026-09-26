// Runs before every test file (jest `setupFiles`), before the app reads its env.
// Tests write to the database, so they must never point at the development
// database: use TEST_DATABASE_URL, or DATABASE_URL with "_test" appended to the
// database name.
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const devUrl = process.env.DATABASE_URL;
let testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl && devUrl) {
  const url = new URL(devUrl);
  const dbName = url.pathname.replace(/^\//, '');
  if (!dbName.endsWith('_test')) url.pathname = `/${dbName}_test`;
  testUrl = url.toString();
}
if (!testUrl) throw new Error('Set TEST_DATABASE_URL (or DATABASE_URL) to run the backend tests.');
if (!new URL(testUrl).pathname.endsWith('_test')) {
  throw new Error(`Refusing to run tests against a non-test database (${new URL(testUrl).pathname}).`);
}

process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = process.env.TEST_LOG_LEVEL || 'silent';
process.env.UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads-test');
process.env.EXPORT_DIR = path.resolve(__dirname, '..', 'exports-test');
// Rate limits would make the suite order-dependent; they are covered by their own settings.
process.env.RATE_LIMIT_MAX_GENERAL = '100000';
process.env.RATE_LIMIT_MAX_AUTH = '100000';
process.env.RATE_LIMIT_MAX_EVENTS = '100000';
