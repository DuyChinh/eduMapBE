require('dotenv').config();

const config = {
  mongodb: {
    url: process.env.MIGRATE_MG_URL,
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  },
  migrationsDir: 'src/migrations',
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.js'
};

module.exports = config;
