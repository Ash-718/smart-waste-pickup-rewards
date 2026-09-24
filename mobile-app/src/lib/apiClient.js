const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:4000/api";
const REQUEST_TIMEOUT_MS = 15000;

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

let authToken = null;
let onUnauthorizedHandler = null;

function setAuthToken(token) {
  authToken = token;
}

function setOnUnauthorized(handler) {
  onUnauthorizedHandler = handler;
}

async function apiFetch(path, { method = "GET", body, isFormData = false } = {}) {
  const headers = {};
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

  let requestBody;
  if (body) {
    requestBody = isFormData ? body : JSON.stringify(body);
  }

  // A dropped/filtered connection (e.g. a firewalled LAN backend) hangs
  // indefinitely without this — fetch() has no built-in timeout.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: requestBody,
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err.name === "AbortError") {
      throw new ApiError("The WasteWise server took too long to respond. Try again.", 0);
    }
    throw new ApiError("Unable to connect to the server. Please try again.", 0);
  } finally {
    clearTimeout(timeout);
  }

  const contentType = res.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    if (res.status === 401 && onUnauthorizedHandler && authToken) {
      onUnauthorizedHandler();
    }
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data?.details);
  }
  return data;
}

export { apiFetch, setAuthToken, setOnUnauthorized, ApiError };

