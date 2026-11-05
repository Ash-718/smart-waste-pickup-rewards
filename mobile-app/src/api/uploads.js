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

  let filename = asset.fileName || asset.name || uri.split("/").pop() || "pickup-photo.jpg";
  // Guarantee a valid image extension (fixes Android content:// URIs and phone camera uploads with no ext or .heic)
  if (!/\.(jpe?g|png|webp)$/i.test(filename)) {
    const base = filename.replace(/\.[^/.]+$/, "") || "pickup_photo";
    filename = `${base}.jpg`;
  }

  const match = /\.(\w+)$/.exec(filename);
  const ext = match ? match[1].toLowerCase() : "jpg";
  const type = asset.type || asset.mimeType || `image/${ext === "jpg" ? "jpeg" : ext}`;

  if (Platform.OS === "web") {
    // On web, if asset has a converted uri (blob or data URI from compression), fetch it as a binary Blob
    if (uri && (uri.startsWith("data:") || uri.startsWith("blob:"))) {
      try {
        const res = await fetch(uri);
        const blob = await res.blob();
        form.append("photo", blob, filename);
      } catch {
        if (asset.file) {
          form.append("photo", asset.file, filename);
        } else {
          form.append("photo", { uri, name: filename, type });
        }
      }
    } else if (asset.file) {
      form.append("photo", asset.file, filename);
    } else {
      try {
        const res = await fetch(uri);
        const blob = await res.blob();
        form.append("photo", blob, filename);
      } catch {
        form.append("photo", { uri, name: filename, type });
      }
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
