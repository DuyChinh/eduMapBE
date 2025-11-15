require('dotenv').config();

const config = {
  mongodb: {
    url: process.env.MIGRATE_MG_URL || 'mongodb+srv://chinhdd:210203chinH@cluster0.qt9aarw.mongodb.net/EduMap?retryWrites=true&w=majority&appName=Cluster0'
  },
  migrationsDir: 'src/migrations',
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.js'
};

module.exports = config;
