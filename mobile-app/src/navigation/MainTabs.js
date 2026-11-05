import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, StyleSheet, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import HomeScreen from "../screens/HomeScreen";
import MyPickupsScreen from "../screens/MyPickupsScreen";
import ImpactScreen from "../screens/ImpactScreen";
import RewardsScreen from "../screens/RewardsScreen";
import BadgesScreen from "../screens/BadgesScreen";
import { colors } from "../theme/colors";

const Tab = createBottomTabNavigator();

// Vector icon mappings styled after top-tier consumer apps (Apple, Uber, Airbnb, Shopify)
const TAB_ICONS = {
  Home: { active: "home", inactive: "home-outline" },
  Pickups: { active: "cube", inactive: "cube-outline" },
  Impact: { active: "leaf", inactive: "leaf-outline" },
  Rewards: { active: "gift", inactive: "gift-outline" },
  Badges: { active: "trophy", inactive: "trophy-outline" },
};

function TabIcon({ routeName, focused }) {
  const iconConfig = TAB_ICONS[routeName] || { active: "ellipse", inactive: "ellipse-outline" };
  const iconName = focused ? iconConfig.active : iconConfig.inactive;

  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons
        name={iconName}
        size={20}
        color={focused ? colors.brand700 : colors.neutral400}
      />
    </View>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand700,
        tabBarInactiveTintColor: colors.neutral400,
        tabBarIcon: ({ focused }) => <TabIcon routeName={route.name} focused={focused} />,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.neutral200,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 86 : 70,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 24 : 8,
          elevation: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          justifyContent: "center",
          alignItems: "center",
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: "600",
          letterSpacing: 0.1,
          marginTop: 2,
          marginBottom: 2,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Pickups" component={MyPickupsScreen} options={{ title: "My Pickups" }} />
      <Tab.Screen name="Impact" component={ImpactScreen} options={{ title: "My Impact" }} />
      <Tab.Screen name="Rewards" component={RewardsScreen} />
      <Tab.Screen name="Badges" component={BadgesScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    width: 34,
    height: 26,
    borderRadius: 13,
  },
  iconWrapActive: {
    backgroundColor: colors.brand50,
  },
});
