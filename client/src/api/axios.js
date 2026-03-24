import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:3002",
  withCredentials: true, // ⭐ allow cookies
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use((response) => {
  const data = response.data;

  if (data && data._id) {
    data.id = data._id;
  }

  return response;
});

export default api;