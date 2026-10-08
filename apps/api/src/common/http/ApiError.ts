export class ApiError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
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

  public static internal(message = "Internal server error", code = "INTERNAL_ERROR"): ApiError {
    return new ApiError(500, code, message);
  }
}
