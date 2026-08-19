import axios from "axios";

const baseURL = import.meta.env.VITE_NET_API_URL || "http://localhost:3000/api/v1";
const envToken = import.meta.env.VITE_NET_API_TOKEN || "";

export const api = axios.create({
  baseURL,
  timeout: 8000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("net_api_token") || envToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
