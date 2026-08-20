import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Text } from "react-native";
import HomeScreen from "../screens/HomeScreen";
import MyPickupsScreen from "../screens/MyPickupsScreen";
import RewardsScreen from "../screens/RewardsScreen";
import BadgesScreen from "../screens/BadgesScreen";
import { colors } from "../theme/colors";

const Tab = createBottomTabNavigator();

const ICONS = {
  Home: "🏠",
  Pickups: "🚚",
  Rewards: "🎁",
  Badges: "🏅",
};

function TabIcon({ route, focused }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{ICONS[route.name]}</Text>;
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand700,
        tabBarInactiveTintColor: colors.neutral400,
        tabBarIcon: ({ focused }) => <TabIcon route={route} focused={focused} />,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Pickups" component={MyPickupsScreen} options={{ title: "My Pickups" }} />
      <Tab.Screen name="Rewards" component={RewardsScreen} />
      <Tab.Screen name="Badges" component={BadgesScreen} />
    </Tab.Navigator>
  );
}
