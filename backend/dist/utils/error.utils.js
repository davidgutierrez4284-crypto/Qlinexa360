"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
const handleError = (err) => {
    if (err instanceof AppError) {
        return {
            status: err.status,
            statusCode: err.statusCode,
            message: err.message
        };
    }
    // Error no operacional
    console.error('ERROR 💥', err);
    return {
        status: 'error',
        statusCode: 500,
        message: 'Algo salió mal'
    };
};
exports.handleError = handleError;
