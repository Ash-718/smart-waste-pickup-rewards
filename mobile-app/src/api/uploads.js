import { Platform } from "react-native";
import { apiFetch } from "../lib/apiClient";

// `asset` is an expo-image-picker result asset ({ uri, fileName?, mimeType?, file? }).
export async function uploadPickupPhoto(asset) {
  const form = new FormData();

  if (asset.file) {
    form.append("photo", asset.file);
  } else if (Platform.OS === "web" && asset.uri) {
    try {
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      form.append("photo", blob, asset.fileName || "pickup-photo.jpg");
    } catch {
      form.append("photo", {
        uri: asset.uri,
        name: asset.fileName || "pickup-photo.jpg",
        type: asset.mimeType || "image/jpeg",
      });
    }
  } else {
    form.append("photo", {
      uri: asset.uri,
      name: asset.fileName || "pickup-photo.jpg",
      type: asset.mimeType || "image/jpeg",
    });
  }

  return apiFetch("/uploads/pickup-photo", { method: "POST", body: form, isFormData: true });
}
