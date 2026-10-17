import { Platform } from "react-native";
import { apiFetch } from "../lib/apiClient";

// `asset` is an expo-image-picker or expo-image-manipulator result asset ({ uri, fileName?, mimeType?, file? }).
export async function uploadPickupPhoto(asset) {
  const form = new FormData();

  let uri = asset.uri;
  // On Android, ensure uri has a valid scheme (file:// or content://)
  if (Platform.OS === "android" && !uri.startsWith("file://") && !uri.startsWith("content://")) {
    uri = `file://${uri}`;
  }

  const filename = asset.fileName || uri.split("/").pop() || "pickup-photo.jpg";
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1].toLowerCase()}` : (asset.mimeType || "image/jpeg");

  if (asset.file) {
    form.append("photo", asset.file);
  } else if (Platform.OS === "web") {
    try {
      const res = await fetch(uri);
      const blob = await res.blob();
      form.append("photo", blob, filename);
    } catch {
      form.append("photo", { uri, name: filename, type });
    }
  } else {
    // React Native FormData expects an object with uri, name, and type
    form.append("photo", {
      uri,
      name: filename,
      type,
    });
  }

  return apiFetch("/uploads/pickup-photo", { method: "POST", body: form, isFormData: true });
}
