import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Pre-configured Axios instance for application-wide API requests.
 * - withCredentials: true ensures Better Auth session cookies are sent automatically.
 * - baseURL: defaults to '/api' (or VITE_API_URL if specified).
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor: normalize URL to prevent duplicate /api prefixes
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // If baseURL ends with '/api' and config.url starts with '/api' (e.g., '/api/users'),
    // strip the leading '/api' from url so it resolves to '/api/users' instead of '/api/api/users'.
    const baseEndsWithApi = config.baseURL ? /\/api\/?$/.test(config.baseURL) : false;
    if (baseEndsWithApi && config.url && config.url.startsWith('/api')) {
      config.url = config.url.replace(/^\/api/, '') || '/';
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor: safely extract and normalize error messages
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    let customMessage = 'An unexpected network error occurred';

    if (error.response?.data) {
      if (typeof error.response.data === 'object' && error.response.data !== null) {
        const data = error.response.data as { error?: string; message?: string };
        customMessage = data.error || data.message || customMessage;
        data.error = customMessage;
      } else if (typeof error.response.data === 'string') {
        // Handles HTML error responses (e.g., Express 404/500 default pages)
        if (error.response.status === 404) {
          customMessage = `API endpoint not found (404): ${error.config?.url || ''}`;
        } else {
          customMessage = error.response.statusText || `Server error (${error.response.status})`;
        }
        // Normalize response.data into structured object
        error.response.data = { error: customMessage };
      }
    } else if (error.message) {
      customMessage = error.message;
    }

    return Promise.reject(error);
  }
);

export default api;
