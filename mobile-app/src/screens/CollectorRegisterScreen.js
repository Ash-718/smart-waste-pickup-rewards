import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import TextField from "../components/TextField";
import Button from "../components/Button";
import { applyCollector } from "../api/auth";
import { colors } from "../theme/colors";

const VEHICLE_PREFERENCES = [
  { id: "electric_van", label: "⚡ Electric Mini Van (500kg)" },
  { id: "electric_trike", label: "🛵 Electric Cargo Trike (250kg)" },
  { id: "heavy_ev", label: "🚛 Eicher Pro EV Recycler (1000kg)" },
  { id: "any", label: "🌱 Any Available Fleet Vehicle" },
];

export default function CollectorRegisterScreen({ navigation }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [vehiclePref, setVehiclePref] = useState("electric_van");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [submittedData, setSubmittedData] = useState(null);

  async function handleSubmit() {
    setError(null);
    if (!name.trim() || name.trim().length < 2) {
      return setError("Please provide your full legal name.");
    }
    if (!email.trim() || !email.includes("@")) {
      return setError("Please provide a valid email address.");
    }
    if (!phone.trim() || phone.trim().length < 7) {
      return setError("Please provide a valid contact phone number.");
    }
    if (password.length < 6) {
      return setError("Password must be at least 6 characters.");
    }
    if (!address.trim() || address.trim().length < 5) {
      return setError("Please enter your complete residential address.");
    }

    setSubmitting(true);
    try {
      const res = await applyCollector({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        password,
        address: address.trim(),
        licenseNumber: licenseNumber.trim() || undefined,
        vehicleTypePref: vehiclePref,
      });

      setSubmittedData(res.application || { name, email, status: "pending" });
    } catch (err) {
      setError(err.message || "Failed to submit collector application.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedData) {
    return (
      <View style={styles.successContainer}>
        <View style={styles.successCard}>
          <View style={styles.successIconBadge}>
            <Ionicons name="checkmark-done-circle" size={56} color={colors.brand600} />
          </View>

          <Text style={styles.successTitle}>Application Submitted!</Text>
          <Text style={styles.successSub}>
            Thank you, <Text style={styles.boldText}>{submittedData.name}</Text>. Your application to join Pruthvi
            Foundation as an official waste collector & driver has been securely logged.
          </Text>

          <View style={styles.statusBox}>
            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />
              <Text style={styles.statusBadgeText}>STATUS: PENDING ADMIN REVIEW</Text>
            </View>
            <Text style={styles.statusExplain}>
              Our NGO administrators will verify your credentials and assign an appropriate fleet vehicle. Once approved,
              your collector account will be activated and you can log in directly using your email and password.
            </Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Registered Email:</Text>
              <Text style={styles.metaVal}>{submittedData.email}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Contact Phone:</Text>
              <Text style={styles.metaVal}>{submittedData.phone}</Text>
            </View>
          </View>

          <Button
            title="Return to Sign In"
            onPress={() => navigation.navigate("Login")}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.neutral800} />
          </TouchableOpacity>
          <View style={styles.headerIcon}>
            <Text style={styles.headerEmoji}>🚛</Text>
          </View>
          <Text style={styles.title}>Join as a Collector</Text>
          <Text style={styles.subtitle}>
            Drive for the Pruthvi ZeroWaste Foundation. Collect recyclables, track trips in real-time, and earn verified rewards.
          </Text>
        </View>

        {/* Notice Card */}
        <View style={styles.noticeCard}>
          <Ionicons name="shield-checkmark" size={20} color={colors.brand700} style={{ marginRight: 8 }} />
          <Text style={styles.noticeText}>
            Collector applications require NGO admin verification. Once approved, you will be assigned a fleet vehicle and dispatch routes.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <TextField
            label="Full Legal Name *"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            placeholder="e.g. Vikram Sharma"
          />

          <TextField
            label="Email Address *"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder="e.g. vikram@example.com"
          />

          <TextField
            label="Phone Number *"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="e.g. +91 98765 43210"
          />

          <TextField
            label="Create Password *"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            placeholder="Minimum 6 characters"
          />

          <TextField
            label="Residential Address *"
            value={address}
            onChangeText={setAddress}
            multiline
            numberOfLines={2}
            placeholder="Street address, sector/locality, city, pincode"
          />

          <TextField
            label="Commercial / Driving License Details (Optional)"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            autoCapitalize="characters"
            placeholder="e.g. DL-0420110012345"
          />

          {/* Vehicle Type Preference */}
          <View style={styles.prefSection}>
            <Text style={styles.prefLabel}>Vehicle Type Preference</Text>
            <View style={styles.prefGrid}>
              {VEHICLE_PREFERENCES.map((pref) => {
                const isSelected = vehiclePref === pref.id;
                return (
                  <TouchableOpacity
                    key={pref.id}
                    onPress={() => setVehiclePref(pref.id)}
                    style={[styles.prefCard, isSelected && styles.prefCardSelected]}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.prefCardText, isSelected && styles.prefCardTextSelected]}>
                      {pref.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {error && <Text style={styles.error}>{error}</Text>}

          <Button
            title="Submit Collector Application"
            onPress={handleSubmit}
            loading={submitting}
          />

          <View style={styles.secondaryAction}>
            <Button
              title="Already registered? Sign in"
              variant="outline"
              onPress={() => navigation.navigate("Login")}
            />
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 48,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 20,
    position: "relative",
  },
  backBtn: {
    position: "absolute",
    left: 0,
    top: 4,
    padding: 6,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.brand100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  headerEmoji: {
    fontSize: 26,
  },
  title: {
    color: colors.neutral900,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: colors.neutral500,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.brand50 || "#ecfdf5",
    borderWidth: 1,
    borderColor: colors.brand200 || "#a7f3d0",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  noticeText: {
    color: colors.brand800 || "#065f46",
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
    fontWeight: "500",
  },
  form: {
    marginTop: 4,
  },
  prefSection: {
    marginBottom: 16,
  },
  prefLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.neutral700,
    marginBottom: 8,
  },
  prefGrid: {
    gap: 8,
  },
  prefCard: {
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.neutral200,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  prefCardSelected: {
    borderColor: colors.brand600,
    backgroundColor: colors.brand50 || "#ecfdf5",
  },
  prefCardText: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.neutral700,
  },
  prefCardTextSelected: {
    fontWeight: "700",
    color: colors.brand700,
  },
  error: {
    color: colors.red600,
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },
  secondaryAction: {
    marginTop: 12,
  },
  successContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  successCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.neutral200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  successIconBadge: {
    alignItems: "center",
    marginBottom: 14,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.neutral900,
    textAlign: "center",
  },
  successSub: {
    fontSize: 13,
    color: colors.neutral600,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  boldText: {
    fontWeight: "700",
    color: colors.neutral900,
  },
  statusBox: {
    backgroundColor: colors.neutral50,
    borderWidth: 1,
    borderColor: colors.neutral200,
    borderRadius: 14,
    padding: 14,
    marginVertical: 18,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fde68a",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#d97706",
    marginRight: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#92400e",
    letterSpacing: 0.5,
  },
  statusExplain: {
    fontSize: 11,
    color: colors.neutral600,
    lineHeight: 16,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.neutral200,
    paddingTop: 6,
    marginTop: 4,
  },
  metaLabel: {
    fontSize: 11,
    color: colors.neutral500,
  },
  metaVal: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral800,
  },
});
