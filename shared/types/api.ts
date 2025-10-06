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

export type InAppNotification = {
  id: string;
  title: string;
  content: string;
  isBroadCast: boolean;
};

export type Paginated<T> = {
  data: T[];
  page: number;
  total: number;
};
