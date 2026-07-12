import { Pool } from 'pg';

if (!global.pgPool) {
    global.pgPool = new Pool({
        connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_YQxu8LlSZMf4@ep-small-shape-atrhlzeh-pooler.c-9.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require',
    });
}
const pool = global.pgPool;
export default pool;
