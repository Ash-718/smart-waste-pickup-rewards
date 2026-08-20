import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import TextField from "../components/TextField";
import Button from "../components/Button";
import { colors } from "../theme/colors";

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) return setError("Name is required");
    if (!identifier.trim()) return setError("Email or phone is required");
    if (password.length < 6) return setError("Password must be at least 6 characters");

    setSubmitting(true);
    try {
      const isEmail = identifier.includes("@");
      await register({
        name,
        password,
        ...(isEmail ? { email: identifier } : { phone: identifier }),
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Join WasteWise to book recyclable pickups and earn points.</Text>

        <View style={styles.form}>
          <TextField label="Full name" value={name} onChangeText={setName} autoComplete="name" />
          <TextField
            label="Email or phone"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Button title="Create account" onPress={handleSubmit} loading={submitting} />

          <View style={styles.secondaryAction}>
            <Button title="Back to sign in" variant="outline" onPress={() => navigation.goBack()} />
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
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  title: {
    color: colors.neutral900,
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.neutral500,
    fontSize: 13,
    marginTop: 4,
  },
  form: {
    marginTop: 24,
  },
  error: {
    color: colors.red600,
    fontSize: 13,
    marginBottom: 12,
  },
  secondaryAction: {
    marginTop: 12,
  },
});
