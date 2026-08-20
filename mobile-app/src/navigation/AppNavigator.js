import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import BookPickupScreen from "../screens/BookPickupScreen";
import PickupDetailScreen from "../screens/PickupDetailScreen";
import { colors } from "../theme/colors";

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.neutral900,
        headerStyle: { backgroundColor: colors.white },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="BookPickup"
        component={BookPickupScreen}
        options={{ title: "Book a Pickup" }}
      />
      <Stack.Screen
        name="PickupDetail"
        component={PickupDetailScreen}
        options={{ title: "Pickup Details" }}
      />
    </Stack.Navigator>
  );
}
