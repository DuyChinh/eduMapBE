// This file exports middleware functions that can be used to process requests before they reach the route handlers.

const exampleMiddleware = (req, res, next) => {
    console.log('Example middleware executed');
    next();
};

module.exports = {
    exampleMiddleware,
};