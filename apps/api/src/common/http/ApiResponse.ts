export class ApiResponse<T = any> {
  public success: boolean;
  public statusCode: number;
  public message: string;
  public data?: T;

  constructor(statusCode: number, message: string, data?: T) {
    this.success = statusCode >= 200 && statusCode < 300;
    this.statusCode = statusCode;
    this.message = message;
    if (data !== undefined) {
      this.data = data;
    }
  }

  public static success<T>(data: T, message = "Success", statusCode = 200): ApiResponse<T> {
    return new ApiResponse<T>(statusCode, message, data);
  }

  public static error(message: string, statusCode = 400): ApiResponse {
    return new ApiResponse(statusCode, message);
  }
}
