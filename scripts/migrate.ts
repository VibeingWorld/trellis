// Initial schema creation is idempotent and runs before any application query.
// Future numbered migrations should execute here before the application starts.
import { sqlite, dataDirectory } from '../src/db';
console.log(`Schema is ready in ${dataDirectory}`);
sqlite.close();
