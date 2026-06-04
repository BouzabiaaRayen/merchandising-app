import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    const result = await login(username, password);
    setLoading(false);

    if (!result.success) {
      Alert.alert('Login Failed', result.error);
    } else {
      // Login successful - Navigation component will handle the redirect
      console.log('Login successful, navigating to home...');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.backgroundOrbTop} />
          <View style={styles.backgroundOrbBottom} />

          <View style={styles.formCard}>
            <Text style={styles.formKicker}>Welcome back</Text>
            <Text style={styles.formTitle}>Sign in to continue</Text>
            <Text style={styles.formDescription}>
              Use your company account to access today&apos;s activity and assignments.
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Email or username</Text>
              <View style={styles.inputShell}>
                <View style={styles.inputIconWrap}>
                  <MaterialCommunityIcons name="account-outline" size={20} color="#3153d3" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="name@company.com"
                  placeholderTextColor="#8b98b4"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <Pressable>
                  <Text style={styles.inlineLink}>Forgot password?</Text>
                </Pressable>
              </View>
              <View style={styles.inputShell}>
                <View style={styles.inputIconWrap}>
                  <MaterialCommunityIcons name="lock-outline" size={20} color="#3153d3" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor="#8b98b4"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  style={styles.visibilityButton}
                  onPress={() => setShowPassword((current) => !current)}
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color="#5d6b8a"
                  />
                </Pressable>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaBadge}>
                <MaterialCommunityIcons name="shield-check-outline" size={16} color="#2563eb" />
                <Text style={styles.metaBadgeText}>Secure session</Text>
              </View>
              <Text style={styles.metaText}>Fast mobile access</Text>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading === true}
              activeOpacity={0.9}
            >
              {loading ? (
                <View style={styles.buttonContent}>
                  <ActivityIndicator size="small" color="#ffffff" />
                  <Text style={styles.buttonText}>Signing in...</Text>
                </View>
              ) : (
                <View style={styles.buttonContent}>
                  <Text style={styles.buttonText}>Enter workspace</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#ffffff" />
                </View>
              )}
            </TouchableOpacity>

            <Pressable style={styles.supportRow} onPress={() => navigation?.navigate?.('Register')}>
              <Text style={styles.supportText}>Need an account?</Text>
              <Text style={styles.supportLink}> Request access</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#071120',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingTop: 24,
    paddingBottom: 28,
    backgroundColor: '#071120',
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: 40,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(59, 130, 246, 0.18)',
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: 140,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(14, 165, 233, 0.12)',
  },
  formCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    padding: 22,
    borderRadius: 28,
    backgroundColor: '#f7faff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    shadowColor: '#020617',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  formKicker: {
    color: '#3153d3',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  formTitle: {
    color: '#10203a',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 10,
  },
  formDescription: {
    color: '#66748f',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 22,
  },
  formGroup: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: '#10203a',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  inlineLink: {
    color: '#3153d3',
    fontSize: 13,
    fontWeight: '700',
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d8e0f0',
  },
  inputIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e9efff',
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#10203a',
  },
  visibilityButton: {
    padding: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
    marginTop: 4,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#ebf3ff',
  },
  metaBadgeText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '700',
  },
  metaText: {
    color: '#7a879e',
    fontSize: 12,
    fontWeight: '600',
  },
  button: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: '#3153d3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3153d3',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  supportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  supportText: {
    color: '#66748f',
    fontSize: 14,
  },
  supportLink: {
    color: '#3153d3',
    fontSize: 14,
    fontWeight: '800',
  },
});
