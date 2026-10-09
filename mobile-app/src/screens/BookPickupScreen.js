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
  const [error, setError] = useState(null);

  const uploadMutation = useMutation({ mutationFn: uploadPickupPhoto });
  const createMutation = useMutation({
    mutationFn: createPickup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pickups"] });
      navigation.goBack();
    },
  });

  async function processSelectedAsset(asset) {
    setPhotoPreviewUri(asset.uri);
    setPhotoUrl(null);
    setError(null);

    try {
      const uploaded = await uploadMutation.mutateAsync(asset);
      setPhotoUrl(uploaded.photoUrl);
    } catch (err) {
      setError(err.message || "Failed to upload photo. You can try retaking it.");
    }
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
        allowsEditing: true,
      });

      if (result.canceled || !result.assets?.length) return;
      await processSelectedAsset(result.assets[0]);
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
        allowsEditing: true,
      });

      if (result.canceled || !result.assets?.length) return;
      await processSelectedAsset(result.assets[0]);
    } catch (err) {
      setError("Unable to open gallery: " + err.message);
    }
  }

  function handleRemovePhoto() {
    setPhotoPreviewUri(null);
    setPhotoUrl(null);
  }

  function handleSubmit() {
    setError(null);
    if (!wasteType) return setError("Choose a waste type");
    if (!quantityBand) return setError("Choose a quantity");
    if (!slotPeriod) return setError("Choose a pickup slot");
    if (!address.trim()) return setError("Address is required");

    createMutation.mutate({
      wasteType,
      quantityBand,
      slotPeriod,
      address: address.trim(),
      requestedDate: requestedDate.toISOString(),
      ...(photoUrl ? { photoUrl } : {}),
    });
  }

  const submitting = createMutation.isPending;

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
            {uploadMutation.isPending && (
              <View style={styles.photoOverlay}>
                <ActivityIndicator color={colors.white} />
                <Text style={styles.uploadingText}>Uploading photo…</Text>
              </View>
            )}
            <View style={styles.photoActionRow}>
              <Pressable
                style={[styles.smallBtn, styles.retakeBtn]}
                onPress={handleTakePhoto}
                disabled={uploadMutation.isPending}
              >
                <Text style={styles.smallBtnText}>📷 Retake</Text>
              </Pressable>
              <Pressable
                style={[styles.smallBtn, styles.galleryBtn]}
                onPress={handlePickGallery}
                disabled={uploadMutation.isPending}
              >
                <Text style={styles.smallBtnText}>🖼️ Choose Other</Text>
              </Pressable>
              <Pressable
                style={[styles.smallBtn, styles.removeBtn]}
                onPress={handleRemovePhoto}
                disabled={uploadMutation.isPending}
              >
                <Text style={[styles.smallBtnText, styles.removeBtnText]}>🗑️ Remove</Text>
              </Pressable>
            </View>
            {photoUrl && (
              <Text style={styles.uploadedBadge}>✓ Photo uploaded & attached successfully</Text>
            )}
          </View>
        ) : (
          <View style={styles.photoOptionsGrid}>
            <Pressable style={styles.photoOptionBox} onPress={handleTakePhoto}>
              <Text style={styles.photoOptionIcon}>📷</Text>
              <Text style={styles.photoOptionTitle}>Take Photo</Text>
              <Text style={styles.photoOptionSubtitle}>Use device camera</Text>
            </Pressable>

            <Pressable style={styles.photoOptionBox} onPress={handlePickGallery}>
              <Text style={styles.photoOptionIcon}>🖼️</Text>
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
