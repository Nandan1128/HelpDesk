import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Pre-configured Axios instance for application-wide API requests.
 * - withCredentials: true ensures Better Auth session cookies are sent automatically.
 * - baseURL: uses VITE_API_URL or defaults to root (proxy handles /api in dev).
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor for unified error extraction
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError<{ error?: string; message?: string }>) => {
    // Standardize error message from backend if available
    const customMessage =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected network error occurred';

    // Attach human-readable message to error object
    if (error.response && error.response.data) {
      error.response.data.error = customMessage;
    }

    return Promise.reject(error);
  }
);

export default api;
