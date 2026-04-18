
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dashboardStatsSQL = fs.readFileSync(path.join(__dirname, '../FIX_DASHBOARD_STATS.sql'), 'utf-8');

console.log('--- COPY THE SQL BELOW THIS LINE ---');
console.log(dashboardStatsSQL);
console.log('--- END OF SQL ---');
