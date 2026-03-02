import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Screens
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import PlanningScreen from '../screens/PlanningScreen';
import ProfileScreen from '../screens/ProfileScreen';
import VisitExecutionScreen from '../screens/VisitExecutionScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Placeholder screens for tabs
const PlaceholderScreen = ({ route }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: 20, color: '#888' }}>{route.name} Screen Coming Soon</Text>
  </View>
);

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

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#4285f4',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e8eaed',
          backgroundColor: '#fff',
          height: 60,
          paddingBottom: 8,
          paddingTop: 8
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600'
        },
        tabBarIcon: ({ color, size }) => {
          let iconName = 'circle-outline';
          if (route.name === 'Home') iconName = 'home';
          if (route.name === 'Planning') iconName = 'calendar-check';
          if (route.name === 'GMS') iconName = 'map-marker';
          if (route.name === 'Objectives') iconName = 'target';
          if (route.name === 'Profile') iconName = 'account-circle';
          return <MaterialCommunityIcons name={iconName} size={26} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false, tabBarLabel: 'Home' }} />
      <Tab.Screen name="Planning" component={PlanningScreen} options={{ headerShown: false, tabBarLabel: 'Planning' }} />
      <Tab.Screen name="GMS" component={PlaceholderScreen} options={{ tabBarLabel: 'GMS' }} />
      <Tab.Screen name="Objectives" component={PlaceholderScreen} options={{ tabBarLabel: 'Objectives' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false, tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

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
    </Stack.Navigator>
  );
}

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

  return (
    <NavigationContainer>
      {user ? <MainStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
