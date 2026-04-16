import fs from 'fs';
import path from 'path';
import pool from '../src/db';

async function initDb() {
    const client = await pool.connect();
    try {
        console.log('Reading schema file...');
        const schemaPath = path.join(__dirname, '../src/schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing schema...');
        await client.query(schemaSql);

        console.log('Database initialized successfully!');
    } catch (err) {
        console.error('Error initializing database:', err);
        process.exit(1);
    } finally {
        client.release();
        pool.end();
    }
}

initDb();
