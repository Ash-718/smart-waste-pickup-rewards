const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let authToken = null;

function setAuthToken(token) {
  authToken = token;
}

async function apiFetch(path, { method = "GET", body, isFormData = false } = {}) {
  const headers = {};
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let requestBody;
  if (body) {
    requestBody = isFormData ? body : JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { method, headers, body: requestBody });

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.details);
  }
  return data;
}

export { apiFetch, setAuthToken, ApiError };
