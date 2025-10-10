export class AppError extends Error {
  public statusCode: number;

  constructor(message: string, status: number = 500) {
    super(message);
    this.statusCode = status;
    this.name = "AppError";
  }
}

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message?: string;
};

