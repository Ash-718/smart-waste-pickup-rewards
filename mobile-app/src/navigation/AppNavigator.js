import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import BookPickupScreen from "../screens/BookPickupScreen";
import PickupDetailScreen from "../screens/PickupDetailScreen";
import ImpactScreen from "../screens/ImpactScreen";
import TrackPickupScreen from "../screens/TrackPickupScreen";
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
      <Stack.Screen
        name="Impact"
        component={ImpactScreen}
        options={{ title: "Environmental Impact" }}
      />
      <Stack.Screen
        name="TrackPickup"
        component={TrackPickupScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
