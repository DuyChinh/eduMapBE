const { exec } = require('child_process');
require('dotenv').config();

const command = process.argv[2];

const commands = {
  up: 'migrate-mongo up',
  down: 'migrate-mongo down',
  status: 'migrate-mongo status',
  create: (name) => `migrate-mongo create ${name}`
};

if (command === 'create') {
  const name = process.argv[3];
  if (!name) {
    console.error('Please provide migration name');
    process.exit(1);
  }
  exec(commands.create(name), (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error}`);
      return;
    }
    console.log(stdout);
  });
} else if (commands[command]) {
  exec(commands[command], (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error}`);
      return;
    }
    console.log(stdout);
  });
} else {
  console.log('Available commands: up, down, status, create <name>');
}
