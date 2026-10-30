const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";
const SOCKET_BASE_URL = import.meta.env.VITE_SOCKET_BASE_URL || "http://localhost:4000";

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let authToken = (() => {
  try {
    return sessionStorage.getItem("wastewise_admin_token") || null;
  } catch {
    return null;
  }
})();

function setAuthToken(token) {
  authToken = token;
  try {
    if (token) {
      sessionStorage.setItem("wastewise_admin_token", token);
    } else {
      sessionStorage.removeItem("wastewise_admin_token");
    }
  } catch {}
}

function getAuthToken() {
  if (!authToken) {
    try {
      authToken = sessionStorage.getItem("wastewise_admin_token") || null;
    } catch {}
  }
  return authToken;
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

function getMediaUrl(relativeOrAbsoluteUrl) {
  if (!relativeOrAbsoluteUrl) return null;
  if (relativeOrAbsoluteUrl.startsWith("http://") || relativeOrAbsoluteUrl.startsWith("https://")) {
    return relativeOrAbsoluteUrl;
  }
  const base = SOCKET_BASE_URL;
  const cleanPath = relativeOrAbsoluteUrl.startsWith("/") ? relativeOrAbsoluteUrl : `/${relativeOrAbsoluteUrl}`;
  return `${base}${cleanPath}`;
}

export { apiFetch, setAuthToken, getAuthToken, API_BASE_URL, SOCKET_BASE_URL, ApiError, getMediaUrl };
