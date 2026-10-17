import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DriverHomeScreen from "../screens/DriverHomeScreen";
import DriverJobScreen from "../screens/DriverJobScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator();

export default function DriverNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.neutral900,
        headerStyle: { backgroundColor: colors.white },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="DriverHome"
        component={DriverHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DriverJob"
        component={DriverJobScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
