const config = require('../config');

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ 
        error: config.isDevelopment ? err.message : 'Internal Server Error' 
    });
};

module.exports = { asyncHandler, errorHandler };
