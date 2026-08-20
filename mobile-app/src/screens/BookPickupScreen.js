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

  async function handlePickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library access is needed to attach a picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setPhotoPreviewUri(asset.uri);
    setPhotoUrl(null);
    setError(null);

    try {
      const uploaded = await uploadMutation.mutateAsync(asset);
      setPhotoUrl(uploaded.photoUrl);
    } catch (err) {
      setError(err.message);
      setPhotoPreviewUri(null);
    }
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
          // "compact" renders as a self-contained button that opens its own
          // popover — unlike "default" on iOS, it doesn't need us to manage
          // show/hide state, which is what let the old picker dismiss itself
          // on the first wheel tick before a date could be chosen.
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
        <Text style={styles.label}>Photo (optional)</Text>
        {photoPreviewUri ? (
          <View>
            <Image source={{ uri: photoPreviewUri }} style={styles.photo} resizeMode="cover" />
            {uploadMutation.isPending && (
              <View style={styles.photoOverlay}>
                <ActivityIndicator color={colors.white} />
              </View>
            )}
          </View>
        ) : (
          <Pressable style={styles.photoButton} onPress={handlePickPhoto}>
            <Text style={styles.photoButtonText}>Add a photo</Text>
          </Pressable>
        )}
      </View>

      {(error || createMutation.isError) && (
        <Text style={styles.error}>{error || createMutation.error.message}</Text>
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
  photoButton: {
    alignItems: "center",
    borderColor: colors.neutral200,
    borderRadius: 12,
    borderStyle: "dashed",
    borderWidth: 1,
    paddingVertical: 20,
  },
  photoButtonText: {
    color: colors.neutral500,
    fontSize: 13,
    fontWeight: "600",
  },
  photo: {
    borderRadius: 12,
    height: 160,
    width: "100%",
  },
  photoOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 12,
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  error: {
    color: colors.red600,
    fontSize: 13,
    marginBottom: 12,
  },
});
