// src/api/axios.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:5000", // backend URL
  withCredentials: true, // very important for cookies
});

export default api;
