import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  SafeAreaView, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { authService } from '../services/apiService';

const PasswordField = ({ label, value, onChangeText, show, onToggle, placeholder }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={styles.passwordRow}>
      <TextInput
        style={styles.passwordInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        secureTextEntry={!show}
        autoCapitalize="none"
      />
      <TouchableOpacity onPress={onToggle} style={styles.eyeBtn}>
        <MaterialCommunityIcons name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color="#6b7280" />
      </TouchableOpacity>
    </View>
  </View>
);

export default function ChangePasswordScreen({ navigation }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSave = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      Alert.alert('Requis', 'Remplissez tous les champs.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }
    try {
      setSaving(true);
      await authService.changePassword(oldPassword, newPassword);
      Alert.alert('Succès', 'Mot de passe modifié avec succès.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error('Change password error:', err);
      const detail = err.response?.data;
      let msg = 'Échec de la modification.';
      if (detail?.old_password) msg = 'Ancien mot de passe incorrect.';
      else if (detail?.new_password) msg = Array.isArray(detail.new_password) ? detail.new_password.join('\n') : detail.new_password;
      else if (detail?.error) msg = detail.error;
      else if (typeof detail === 'string') msg = detail;
      Alert.alert('Erreur', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#1e293b" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Changer le mot de passe</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="shield-lock-outline" size={28} color="#2563eb" />
            <Text style={styles.infoText}>
              Choisissez un mot de passe fort avec au moins 8 caractères, incluant des lettres et des chiffres.
            </Text>
          </View>

          <PasswordField
            label="Mot de passe actuel"
            value={oldPassword}
            onChangeText={setOldPassword}
            show={showOld}
            onToggle={() => setShowOld(!showOld)}
            placeholder="Entrez votre mot de passe actuel"
          />

          <PasswordField
            label="Nouveau mot de passe"
            value={newPassword}
            onChangeText={setNewPassword}
            show={showNew}
            onToggle={() => setShowNew(!showNew)}
            placeholder="Entrez le nouveau mot de passe"
          />

          <PasswordField
            label="Confirmer le nouveau mot de passe"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            show={showConfirm}
            onToggle={() => setShowConfirm(!showConfirm)}
            placeholder="Confirmez le nouveau mot de passe"
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>Modifier le mot de passe</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, marginBottom: 24, gap: 12 },
  infoText: { flex: 1, fontSize: 13, color: '#1d4ed8', lineHeight: 18 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fc', borderRadius: 12, borderWidth: 1, borderColor: '#e8eaed' },
  passwordInput: { flex: 1, padding: 14, fontSize: 15, color: '#1e293b' },
  eyeBtn: { paddingHorizontal: 14 },
  saveBtn: { backgroundColor: '#2563eb', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
