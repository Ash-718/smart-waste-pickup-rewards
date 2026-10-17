import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import Screen from "../components/Screen";
import ChipSelector from "../components/ChipSelector";
import TextField from "../components/TextField";
import Button from "../components/Button";
import { useMeta } from "../hooks/useMeta";
import { createPickup } from "../api/pickups";
import { uploadPickupPhoto } from "../api/uploads";
import { colors } from "../theme/colors";

export default function BookPickupScreen({ navigation }) {
  const queryClient = useQueryClient();
  const { meta } = useMeta();

  const [wasteType, setWasteType] = useState(null);
  const [quantityBand, setQuantityBand] = useState(null);
  const [slotPeriod, setSlotPeriod] = useState(null);
  const [address, setAddress] = useState("");
  const [requestedDate, setRequestedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoPreviewUri, setPhotoPreviewUri] = useState(null);
  const [coordinates, setCoordinates] = useState(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState(null);

  const uploadMutation = useMutation({ mutationFn: uploadPickupPhoto });
  const createMutation = useMutation({
    mutationFn: createPickup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickups"] });
      navigation.goBack();
    },
  });

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  function processSelectedAsset(asset) {
    setSelectedAsset(asset);
    setPhotoPreviewUri(asset.uri);
    setPhotoUrl(null);
    setError(null);
  }

  async function handleTakePhoto() {
    setError(null);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError("Camera permission is required to take a live photo.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.length) return;
      processSelectedAsset(result.assets[0]);
    } catch (err) {
      setError("Unable to open camera: " + err.message);
    }
  }

  async function handlePickGallery() {
    setError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Photo library access is needed to select an image.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.length) return;
      processSelectedAsset(result.assets[0]);
    } catch (err) {
      setError("Unable to open gallery: " + err.message);
    }
  }

  function handleRemovePhoto() {
    setSelectedAsset(null);
    setPhotoPreviewUri(null);
    setPhotoUrl(null);
  }

  async function handleDetectLocation() {
    setLocating(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied. Please enter address manually.");
        setLocating(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (loc?.coords) {
        const coords = {
          latitude: parseFloat(loc.coords.latitude.toFixed(6)),
          longitude: parseFloat(loc.coords.longitude.toFixed(6)),
        };
        setCoordinates(coords);

        // Autofill address via reverse geocoding if empty
        if (!address.trim()) {
          try {
            const geocoded = await Location.reverseGeocodeAsync({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
            if (geocoded && geocoded.length > 0) {
              const g = geocoded[0];
              const parts = [g.name, g.street, g.subregion || g.district, g.city, g.postalCode].filter(
                Boolean
              );
              if (parts.length > 0) {
                setAddress(parts.join(", "));
              }
            }
          } catch (geoErr) {
            // Geocoding optional; coordinates already saved
          }
        }
      }
    } catch (err) {
      setError("Unable to get current GPS location: " + err.message);
    } finally {
      setLocating(false);
    }
  }

  async function resolveAddressToCoordinates(addr) {
    // 1. Try native geocoding via expo-location
    try {
      const results = await Location.geocodeAsync(addr);
      if (results && results.length > 0 && results[0].latitude && results[0].longitude) {
        return {
          latitude: parseFloat(results[0].latitude.toFixed(6)),
          longitude: parseFloat(results[0].longitude.toFixed(6)),
        };
      }
    } catch (e) {
      // Fall through to Nominatim
    }

    // 2. Try OpenStreetMap Nominatim with proper User-Agent
    const contactEmail = process.env.EXPO_PUBLIC_CONTACT_EMAIL || "support@pruthvi.ngo";
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&limit=1`,
        {
          headers: {
            "User-Agent": `WasteWise-App/1.0 (${contactEmail})`,
            Accept: "application/json",
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0 && data[0].lat && data[0].lon) {
          return {
            latitude: parseFloat(parseFloat(data[0].lat).toFixed(6)),
            longitude: parseFloat(parseFloat(data[0].lon).toFixed(6)),
          };
        }
      }
    } catch (e) {
      // Nominatim failed or offline
    }

    return null;
  }

  async function handleSubmit() {
    setError(null);
    if (!wasteType) return setError("Choose a waste type");
    if (!quantityBand) return setError("Choose a quantity");
    if (!slotPeriod) return setError("Choose a pickup slot");
    if (!address.trim()) return setError("Address is required");

    let finalCoords = coordinates;
    if (!finalCoords) {
      setLocating(true);
      finalCoords = await resolveAddressToCoordinates(address.trim());
      setLocating(false);
      if (finalCoords) {
        setCoordinates(finalCoords);
      } else {
        return setError(
          "Could not determine GPS coordinates for this address. Please tap 'Use Current GPS Location' above to pinpoint your pickup location."
        );
      }
    }

    let uploadedPhotoUrl = photoUrl;
    if (selectedAsset && !uploadedPhotoUrl) {
      setIsUploadingPhoto(true);
      try {
        const uploadRes = await uploadMutation.mutateAsync(selectedAsset);
        uploadedPhotoUrl = uploadRes.photoUrl;
        setPhotoUrl(uploadedPhotoUrl);
      } catch (uploadErr) {
        setIsUploadingPhoto(false);
        return setError("Photo upload failed: " + (uploadErr.message || "Network error. Please try again or remove photo."));
      } finally {
        setIsUploadingPhoto(false);
      }
    }

    createMutation.mutate({
      wasteType,
      quantityBand,
      slotPeriod,
      address: address.trim(),
      requestedDate: requestedDate.toISOString(),
      ...(uploadedPhotoUrl ? { photoUrl: uploadedPhotoUrl } : {}),
      latitude: finalCoords.latitude,
      longitude: finalCoords.longitude,
    });
  }

  const submitting = createMutation.isPending || isUploadingPhoto;

  return (
    <Screen>
      <ChipSelector
        label="Waste type"
        options={meta?.wasteTypes || []}
        value={wasteType}
        onChange={setWasteType}
      />
      <ChipSelector
        label="Quantity"
        options={meta?.quantityBands || []}
        value={quantityBand}
        onChange={setQuantityBand}
      />
      <ChipSelector
        label="Pickup slot"
        options={meta?.slotPeriods || []}
        value={slotPeriod}
        onChange={setSlotPeriod}
      />

      <TextField
        label="Pickup address"
        value={address}
        onChangeText={setAddress}
        multiline
        placeholder="House / street / area"
      />

      {/* GPS Location Pinning Button & Indicator */}
      <View style={{ marginBottom: 16 }}>
        <Pressable
          onPress={handleDetectLocation}
          disabled={locating}
          style={{
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            paddingHorizontal: 12,
            paddingVertical: 7,
            borderRadius: 8,
            backgroundColor: coordinates ? colors.brand50 : colors.neutral100,
            borderWidth: 1,
            borderColor: coordinates ? colors.brand200 : colors.neutral200,
          }}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.brand700} style={{ marginRight: 6 }} />
          ) : (
            <Ionicons
              name={coordinates ? "location" : "location-outline"}
              size={16}
              color={coordinates ? colors.brand700 : colors.neutral600}
              style={{ marginRight: 6 }}
            />
          )}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: coordinates ? colors.brand800 : colors.neutral700,
            }}
          >
            {coordinates
              ? `GPS Attached (${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)})`
              : "Use Current GPS Location"}
          </Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Pickup date</Text>
        {Platform.OS === "ios" ? (
          <DateTimePicker
            value={requestedDate}
            mode="date"
            display="compact"
            minimumDate={new Date()}
            onValueChange={(event, date) => setRequestedDate(date)}
            style={styles.iosDatePicker}
          />
        ) : (
          <>
            <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
              <Text style={styles.dateButtonText}>{requestedDate.toLocaleDateString()}</Text>
            </Pressable>
            {showDatePicker && (
              <DateTimePicker
                value={requestedDate}
                mode="date"
                minimumDate={new Date()}
                display="default"
                onValueChange={(event, date) => {
                  setShowDatePicker(false);
                  setRequestedDate(date);
                }}
                onDismiss={() => setShowDatePicker(false)}
              />
            )}
          </>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Photo of recyclable waste (optional)</Text>
        {photoPreviewUri ? (
          <View style={styles.previewContainer}>
            <Image source={{ uri: photoPreviewUri }} style={styles.photo} resizeMode="cover" />
            {isUploadingPhoto && (
              <View style={styles.photoOverlay}>
                <ActivityIndicator color={colors.white} />
                <Text style={styles.uploadingText}>Uploading photo...</Text>
              </View>
            )}
            <View style={styles.photoActionRow}>
              <Pressable
                style={[styles.smallBtn, styles.removeBtn]}
                onPress={handleRemovePhoto}
                disabled={isUploadingPhoto}
              >
                <Ionicons name="trash-outline" size={15} color={colors.red600} style={{ marginRight: 4 }} />
                <Text style={[styles.smallBtnText, styles.removeBtnText]}>Remove Photo</Text>
              </Pressable>
            </View>
            {photoUrl && (
              <Text style={styles.uploadedBadge}>✓ Photo attached</Text>
            )}
          </View>
        ) : (
          <View style={styles.photoOptionsGrid}>
            <Pressable style={styles.photoOptionBox} onPress={handleTakePhoto}>
              <Ionicons name="camera-outline" size={26} color={colors.brand700} style={{ marginBottom: 4 }} />
              <Text style={styles.photoOptionTitle}>Take Photo</Text>
              <Text style={styles.photoOptionSubtitle}>Use device camera</Text>
            </Pressable>

            <Pressable style={styles.photoOptionBox} onPress={handlePickGallery}>
              <Ionicons name="images-outline" size={26} color={colors.brand700} style={{ marginBottom: 4 }} />
              <Text style={styles.photoOptionTitle}>Upload from Gallery</Text>
              <Text style={styles.photoOptionSubtitle}>Choose existing image</Text>
            </Pressable>
          </View>
        )}
      </View>

      {(error || createMutation.isError) && (
        <View style={styles.errorContainer}>
          <Text style={styles.error}>{error || createMutation.error.message}</Text>
        </View>
      )}

      <Button
        title="Confirm pickup"
        onPress={handleSubmit}
        loading={submitting}
        disabled={uploadMutation.isPending}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 16,
  },
  label: {
    color: colors.neutral700,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  dateButton: {
    backgroundColor: colors.white,
    borderColor: colors.neutral200,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dateButtonText: {
    color: colors.neutral900,
    fontSize: 15,
  },
  iosDatePicker: {
    alignSelf: "flex-start",
  },
  photoOptionsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  photoOptionBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.neutral200,
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 1.5,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 18,
  },
  photoOptionIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  photoOptionTitle: {
    color: colors.neutral900,
    fontSize: 13,
    fontWeight: "600",
  },
  photoOptionSubtitle: {
    color: colors.neutral500,
    fontSize: 11,
    marginTop: 2,
  },
  previewContainer: {
    backgroundColor: colors.white,
    borderColor: colors.neutral200,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    padding: 8,
  },
  photo: {
    borderRadius: 8,
    height: 180,
    width: "100%",
  },
  photoOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 8,
    bottom: 50,
    justifyContent: "center",
    left: 8,
    position: "absolute",
    right: 8,
    top: 8,
  },
  uploadingText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },
  photoActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  smallBtn: {
    alignItems: "center",
    backgroundColor: colors.neutral100,
    borderRadius: 8,
    flex: 1,
    paddingVertical: 8,
  },
  smallBtnText: {
    color: colors.neutral700,
    fontSize: 12,
    fontWeight: "600",
  },
  removeBtn: {
    backgroundColor: colors.red50,
  },
  removeBtnText: {
    color: colors.red600,
  },
  uploadedBadge: {
    color: colors.brand700,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
  errorContainer: {
    backgroundColor: colors.red50,
    borderColor: colors.red600,
    borderRadius: 8,
    borderWidth: 0.5,
    marginBottom: 12,
    padding: 10,
  },
  error: {
    color: colors.red600,
    fontSize: 13,
  },
});
