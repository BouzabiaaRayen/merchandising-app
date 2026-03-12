import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import PlanningScreen from '../screens/PlanningScreen';
import ProfileScreen from '../screens/ProfileScreen';
import VisitExecutionScreen from '../screens/VisitExecutionScreen';
import ReportsScreen from '../screens/ReportsScreen';
import CongeScreen from '../screens/CongeScreen';

// Supervisor screens
import SupervisorOverviewScreen from '../screens/supervisor/SupervisorOverviewScreen';
import SupervisorTeamScreen from '../screens/supervisor/SupervisorTeamScreen';
import SupervisorMapScreen from '../screens/supervisor/SupervisorMapScreen';
import SupervisorReportScreen from '../screens/supervisor/SupervisorReportScreen';
import SupervisorNotificationsScreen from '../screens/supervisor/SupervisorNotificationsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function AuthStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

const MAIN_TABS = [
  { name: 'Home',     label: 'Home',     icon: 'home-variant',     iconActive: 'home-variant',      color: '#4285f4' },
  { name: 'Planning', label: 'Planning', icon: 'calendar-month-outline', iconActive: 'calendar-check', color: '#8b5cf6' },
  { name: 'Reports',  label: 'Reports',  icon: 'file-document-outline', iconActive: 'file-document',   color: '#f97316' },
  { name: 'Profile',  label: 'Profile',  icon: 'account-outline',  iconActive: 'account-circle',    color: '#22c55e' },
];

const SUPERVISOR_TABS = [
  { name: 'SupervisorOverview', label: 'Overview', icon: 'view-dashboard-outline', iconActive: 'view-dashboard',    color: '#4285f4' },
  { name: 'SupervisorTeam',     label: 'Team',     icon: 'account-group-outline',  iconActive: 'account-group',     color: '#8b5cf6' },
  { name: 'SupervisorMap',      label: 'Map',      icon: 'map-marker-outline',     iconActive: 'map-marker-radius', color: '#f97316' },
  { name: 'SupervisorProfile',  label: 'Profile',  icon: 'account-outline',        iconActive: 'account-circle',    color: '#22c55e' },
];

function CustomTabBar({ state, descriptors, navigation, tabConfig }) {
  return (
    <View style={tabStyles.wrapper}>
      <View style={tabStyles.container}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const cfg = tabConfig[index];

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.8}
              style={tabStyles.tabItem}
            >
              <View style={[tabStyles.pill, isFocused && { backgroundColor: cfg.color + '18' }]}>
                <MaterialCommunityIcons
                  name={isFocused ? cfg.iconActive : cfg.icon}
                  size={24}
                  color={isFocused ? cfg.color : '#b0b8c4'}
                />
                {isFocused && (
                  <Text style={[tabStyles.label, { color: cfg.color }]}>{cfg.label}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} tabConfig={MAIN_TABS} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home"     component={HomeScreen} />
      <Tab.Screen name="Planning" component={PlanningScreen} />
      <Tab.Screen name="Reports"  component={ReportsScreen} />
      <Tab.Screen name="Profile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── Supervisor navigator ─────────────────────────────────────────────────────

function SupervisorTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} tabConfig={SUPERVISOR_TABS} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="SupervisorOverview" component={SupervisorOverviewScreen} />
      <Tab.Screen name="SupervisorTeam"     component={SupervisorTeamScreen} />
      <Tab.Screen name="SupervisorMap"      component={SupervisorMapScreen} />
      <Tab.Screen name="SupervisorProfile"  component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function SupervisorStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen
        name="SupervisorTabs"
        component={SupervisorTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SupervisorReport"
        component={SupervisorReportScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SupervisorNotifications"
        component={SupervisorNotificationsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Conge"
        component={CongeScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// ─── Merchandiser navigator ───────────────────────────────────────────────────

function MainStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="MainTabs" 
        component={MainTabs} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="VisitExecution" 
        component={VisitExecutionScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="Conge" 
        component={CongeScreen} 
        options={{ headerShown: false }} 
      />
    </Stack.Navigator>
  );
}

const tabStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    paddingTop: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eaecf0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 12,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 24,
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default function Navigation() {
  const { user, loading } = useAuth();

  console.log('Navigation render - user:', user ? 'logged in' : 'not logged in', 'loading:', loading);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const isSupervisor =
    user?.role === 'supervisor' || user?.role === 'SUPERVISOR' ||
    user?.role === 'admin' || user?.role === 'ADMIN';

  return (
    <NavigationContainer>
      {user ? (isSupervisor ? <SupervisorStack /> : <MainStack />) : <AuthStack />}
    </NavigationContainer>
  );
}
