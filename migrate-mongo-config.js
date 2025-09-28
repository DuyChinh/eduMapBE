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

// Debug log để kiểm tra
console.log('Database URL:', config.mongodb.url);

module.exports = config;
