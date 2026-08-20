import { apiFetch } from "../lib/apiClient";

export function getMeta() {
  return apiFetch("/meta");
}
