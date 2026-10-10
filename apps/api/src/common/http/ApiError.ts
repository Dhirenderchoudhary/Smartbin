export class ApiError extends Error {
  public statusCode: number;
  public code: string;
  public details?: Record<string, unknown>;

  constructor(statusCode: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public static badRequest(message: string, code = "BAD_REQUEST"): ApiError {
    return new ApiError(400, code, message);
  }

  public static unauthorized(message = "Unauthorized", code = "UNAUTHORIZED"): ApiError {
    return new ApiError(401, code, message);
  }

  public static forbidden(message = "Forbidden", code = "FORBIDDEN"): ApiError {
    return new ApiError(403, code, message);
  }

  public static notFound(message = "Resource not found", code = "NOT_FOUND"): ApiError {
    return new ApiError(404, code, message);
  }

  public static conflict(message: string, code = "CONFLICT", details?: Record<string, unknown>): ApiError {
    return new ApiError(409, code, message, details);
  }

  public static unprocessable(message: string, code = "UNPROCESSABLE"): ApiError {
    return new ApiError(422, code, message);
  }

  public static tooManyRequests(message: string, code = "TOO_MANY_REQUESTS"): ApiError {
    return new ApiError(429, code, message);
  }

  public static internal(message = "Internal server error", code = "INTERNAL_ERROR"): ApiError {
    return new ApiError(500, code, message);
  }

  public static serviceUnavailable(message = "Service unavailable", code = "SERVICE_UNAVAILABLE"): ApiError {
    return new ApiError(503, code, message);
  }
}
