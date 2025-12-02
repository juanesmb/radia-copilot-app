type ErrorOptions = {
  status?: number;
  details?: string;
};

export class HttpError extends Error {
  status: number;
  details?: string;

  constructor(message: string, options: ErrorOptions = {}) {
    super(message);
    this.name = "HttpError";
    this.status = options.status ?? 500;
    this.details = options.details;
  }
}

export const mapErrorToResponse = (error: unknown) => {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: {
        message: error.message,
        details: error.details,
      },
    };
  }

  if (error instanceof Error) {
    return {
      status: 500,
      body: {
        message: "Unexpected server error",
        details: error.message,
      },
    };
  }

  return {
    status: 500,
    body: {
      message: "Unexpected server error",
    },
  };
};

