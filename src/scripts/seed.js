const Seeder = require('../seeders/index');
require('dotenv').config();

const args = process.argv.slice(2);
const shouldClear = args.includes('--clear');

async function runSeeder() {
  const seeder = new Seeder();
  
  if (shouldClear) {
    await seeder.connect();
    await seeder.clearDatabase();
    console.log('✅ Database cleared');
    await seeder.disconnect();
    return;
  }
  
  await seeder.seed();
}

runSeeder().catch(console.error);
