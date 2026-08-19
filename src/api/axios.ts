import axios from "axios";

const envBaseURL = import.meta.env.VITE_NET_API_URL || "http://localhost:3000/api/v1";
const envToken = import.meta.env.VITE_NET_API_TOKEN || "";
const apiUrlKey = "net_api_url";
const apiTokenKey = "net_api_token";

export const api = axios.create({
  baseURL: envBaseURL,
  timeout: 8000,
});

export function getApiBaseUrl() {
  return localStorage.getItem(apiUrlKey) || envBaseURL;
}

export function getApiToken() {
  return localStorage.getItem(apiTokenKey) || envToken;
}

export function saveApiConfig(config: { baseUrl: string; token: string }) {
  const baseUrl = config.baseUrl.trim().replace(/\/+$/, "");
  const token = config.token.trim();

  if (baseUrl) {
    localStorage.setItem(apiUrlKey, baseUrl);
  } else {
    localStorage.removeItem(apiUrlKey);
  }

  if (token) {
    localStorage.setItem(apiTokenKey, token);
  } else {
    localStorage.removeItem(apiTokenKey);
  }
}

api.interceptors.request.use((config) => {
  const token = getApiToken();

  config.baseURL = getApiBaseUrl();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else {
    delete config.headers.Authorization;
  }

  return config;
});
