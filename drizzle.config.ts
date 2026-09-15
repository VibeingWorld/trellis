import { defineConfig } from 'drizzle-kit';
export default defineConfig({ schema: './src/db/schema.ts', out: './drizzle', dialect: 'sqlite', dbCredentials: { url: process.env.DATA_DIR ? `${process.env.DATA_DIR}/trellis.sqlite` : './data/trellis.sqlite' } });
