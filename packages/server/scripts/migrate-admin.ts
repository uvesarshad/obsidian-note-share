import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../packages/server/.env') });
import { query } from '../src/db';

async function migrate() {
    try {
        console.log('Running migration: Add role column to users table...');

        // Check if column exists
        const check = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='role';
    `);

        if (check.rows.length === 0) {
            await query(`ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'user';`);
            console.log('Column role added.');
        } else {
            console.log('Column role already exists.');
        }

        // Set explicit admin for testing if needed (optional)
        // await query(`UPDATE users SET role = 'admin' WHERE email = 'admin@example.com';`);

        console.log('Migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

migrate();
