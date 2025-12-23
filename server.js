const app = require("./src/app")
const http = require('http');
const { Server } = require("socket.io");
const ChangeStreamService = require('./src/services/changeStreamService');

const PORT = process.env.PORT || 3056
const server = http.createServer(app);

const io = new Server(server);

// Initialize Change Stream Service
const changeStreamService = new ChangeStreamService(io);

const startServer = async () => {
  try {
    // Wait for DB connection if needed, but app.js usually handles it.
    // Ideally we want to ensure DB is connected before starting streams.
    // Assuming app.js connects to DB.

    // We delay stream init slightly to ensure DB connection is ready
    setTimeout(() => {
      changeStreamService.init();
    }, 5000);

    server.listen(PORT, () => {
      console.log(`Server start with ${PORT}`)
    })
  } catch (error) {
    console.log(error)
  }
}

startServer();

process.on("SIGINT", () => {
  server.close(() => console.log(`Exit Server Express`))
  // notify.send('....')
})