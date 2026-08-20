import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import TextField from "../components/TextField";
import Button from "../components/Button";
import { colors } from "../theme/colors";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const isEmail = identifier.includes("@");
      await login(isEmail ? { email: identifier, password } : { phone: identifier, password });
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
      <View style={styles.container}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>W</Text>
          </View>
          <Text style={styles.title}>WasteWise</Text>
          <Text style={styles.subtitle}>Pruthvi ZeroWaste Foundation</Text>
        </View>

        <TextField
          label="Email or phone"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoComplete="username"
          keyboardType="email-address"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />

        {error && <Text style={styles.error}>{error}</Text>}

        <Button title="Sign in" onPress={handleSubmit} loading={submitting} />

        <View style={styles.secondaryAction}>
          <Button
            title="Create an account"
            variant="outline"
            onPress={() => navigation.navigate("Register")}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  brand: {
    alignItems: "center",
    marginBottom: 32,
  },
  logo: {
    alignItems: "center",
    backgroundColor: colors.brand600,
    borderRadius: 16,
    height: 48,
    justifyContent: "center",
    marginBottom: 12,
    width: 48,
  },
  logoText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "700",
  },
  title: {
    color: colors.neutral900,
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    color: colors.neutral500,
    fontSize: 13,
    marginTop: 2,
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
