export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (err: Error) => {
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