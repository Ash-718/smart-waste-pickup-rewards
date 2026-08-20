import { apiFetch } from "../lib/apiClient";

// `asset` is an expo-image-picker result asset ({ uri, fileName?, mimeType? }).
export function uploadPickupPhoto(asset) {
  const form = new FormData();
  form.append("photo", {
    uri: asset.uri,
    name: asset.fileName || "pickup-photo.jpg",
    type: asset.mimeType || "image/jpeg",
  });
  return apiFetch("/uploads/pickup-photo", { method: "POST", body: form, isFormData: true });
}
