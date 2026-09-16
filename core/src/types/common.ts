export interface PaginationParams {
  page?: number | string;
  limit?: number | string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  error?: string;
  errors?: Array<{
    field?: string;
    message: string;
  }>;
}

export interface ApiErrorResponse {
  error: string;
  message?: string;
  errors?: Array<{
    path?: (string | number)[];
    message: string;
  }>;
}
