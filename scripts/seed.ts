import { sqlite, dataDirectory } from '../src/db';
const count=sqlite.prepare('SELECT count(*) AS count FROM cards').get();
console.log(`Database initialized at ${dataDirectory}`,count);
sqlite.close();
