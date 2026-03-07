import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
  Image,
  ActivityIndicator
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { authService } from '../services/apiService';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const [avatarUri, setAvatarUri] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Load avatar from user profile
    if (user?.avatar_url) {
      console.log('Loading avatar from:', user.avatar_url);
      setAvatarUri(user.avatar_url);
    }
  }, [user?.avatar_url]);

  const pickImage = async () => {
    try {
      // Request permission
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert(
          'Permission Required',
          'Please allow access to your photos to change your profile picture.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        
        // Check file size (max 5MB)
        if (selectedImage.fileSize && selectedImage.fileSize > 5 * 1024 * 1024) {
          Alert.alert('Error', 'Image size must be less than 5MB');
          return;
        }

        // Show confirmation dialog
        Alert.alert(
          'Upload Avatar',
          'Do you want to upload this image as your profile picture?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Upload',
              onPress: () => uploadAvatar(selectedImage),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const uploadAvatar = async (image) => {
    try {
      setUploading(true);

      // Prepare file object for upload
      const file = {
        uri: image.uri,
        type: image.mimeType || 'image/jpeg',
        fileName: image.fileName || `avatar_${Date.now()}.jpg`,
      };

      console.log('Uploading avatar:', file);

      const updatedProfile = await authService.uploadAvatar(file);

      console.log('Upload response:', updatedProfile);

      // Update local avatar
      const newAvatarUrl = updatedProfile.avatar_url || updatedProfile.avatar;
      if (newAvatarUrl) {
        setAvatarUri(newAvatarUrl);
        Alert.alert('Success', 'Profile picture updated successfully!');
      } else {
        Alert.alert('Warning', 'Upload completed but could not retrieve image URL');
      }
    } catch (error) {
      console.error('Upload error:', error);
      const errorMsg = error.response?.data?.avatar?.[0] || 
                       error.response?.data?.detail || 
                       'Failed to upload profile picture';
      Alert.alert('Error', errorMsg);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await logout();
          }
        }
      ]
    );
  };

  const MenuItem = ({ icon, title, subtitle, onPress, showArrow = true, iconColor = '#4285f4' }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <View style={[styles.menuIcon, { backgroundColor: iconColor + '15' }]}>
        <MaterialCommunityIcons name={icon} size={24} color={iconColor} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
      </View>
      {showArrow && (
        <MaterialCommunityIcons name="chevron-right" size={24} color="#ccc" />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Profile Card */}
        <View style={styles.profileCard}>
          <TouchableOpacity 
            style={styles.avatarContainer}
            onPress={pickImage}
            disabled={uploading}
          >
            <View style={styles.avatar}>
              {avatarUri ? (
                <Image 
                  source={{ uri: avatarUri }} 
                  style={styles.avatarImage}
                  onError={(e) => {
                    console.error('Image load error:', e.nativeEvent.error);
                    setAvatarUri(null);
                  }}
                />
              ) : (
                <MaterialCommunityIcons name="account" size={50} color="#4285f4" />
              )}
              {uploading && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.onlineBadge}>
              {uploading ? (
                <ActivityIndicator size="small" color="#4285f4" />
              ) : (
                <MaterialCommunityIcons name="camera" size={12} color="#4285f4" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>
            {user?.first_name && user?.last_name 
              ? `${user.first_name} ${user.last_name}` 
              : user?.username || 'User'}
          </Text>
          <Text style={styles.userRole}>
            {user?.role === 'merchandiser' ? 'Merchandiser' : 
             user?.role === 'supervisor' ? 'Supervisor' : 
             user?.role === 'admin' ? 'Administrator' : 'Team Member'}
          </Text>
          <Text style={styles.tapToChange}>Tap avatar to change photo</Text>
          {user?.email && (
            <View style={styles.emailRow}>
              <MaterialCommunityIcons name="email-outline" size={16} color="#666" />
              <Text style={styles.userEmail}>{user.email}</Text>
            </View>
          )}
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="account-edit"
              title="Edit Profile"
              subtitle="Update your personal information"
              onPress={() => Alert.alert('Coming Soon', 'Edit profile feature will be available soon')}
            />
            <MenuItem
              icon="lock-outline"
              title="Change Password"
              subtitle="Update your password"
              onPress={() => Alert.alert('Coming Soon', 'Change password feature will be available soon')}
            />
            <MenuItem
              icon="bell-outline"
              title="Notifications"
              subtitle="Manage notification preferences"
              onPress={() => Alert.alert('Coming Soon', 'Notification settings will be available soon')}
            />
          </View>
        </View>

        {/* Work Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WORK</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="chart-box-outline"
              title="Performance"
              subtitle="View your work statistics"
              iconColor="#10b981"
              onPress={() => Alert.alert('Coming Soon', 'Performance metrics will be available soon')}
            />
            <MenuItem
              icon="history"
              title="Visit History"
              subtitle="View completed store visits"
              iconColor="#8b5cf6"
              onPress={() => Alert.alert('Coming Soon', 'Visit history will be available soon')}
            />
            <MenuItem
              icon="map-marker-path"
              title="Routes"
              subtitle="View assigned routes"
              iconColor="#f59e0b"
              onPress={() => Alert.alert('Coming Soon', 'Routes will be available soon')}
            />
            <MenuItem
              icon="calendar-month-outline"
              title="Congés"
              subtitle="Faire une demande et voir l'historique"
              iconColor="#2563eb"
              onPress={() => navigation.navigate('Conge')}
            />
          </View>
        </View>

        {/* App Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>APP</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon="information-outline"
              title="About"
              subtitle="App version 1.0.0"
              iconColor="#6b7280"
              onPress={() => Alert.alert('About', 'Merchandising App v1.0.0\n\nA comprehensive solution for field merchandisers.')}
            />
            <MenuItem
              icon="help-circle-outline"
              title="Help & Support"
              subtitle="Get help or contact support"
              iconColor="#6b7280"
              onPress={() => Alert.alert('Help', 'For support, please contact your supervisor or admin.')}
            />
            <MenuItem
              icon="shield-check-outline"
              title="Privacy Policy"
              subtitle="Read our privacy policy"
              iconColor="#6b7280"
              onPress={() => Alert.alert('Privacy Policy', 'Privacy policy details will be available soon.')}
            />
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color="#dc2626" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { paddingHorizontal: 16, paddingTop: 12 },
  
  // Header
  header: { 
    paddingVertical: 16,
    marginBottom: 8
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#222' },

  // Profile Card
  profileCard: {
    backgroundColor: '#f8f9fc',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e8eaed'
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e8f0fe',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    overflow: 'hidden'
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 50
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4285f4'
  },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981'
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4
  },
  userRole: {
    fontSize: 14,
    color: '#4285f4',
    fontWeight: '600',
    marginBottom: 4
  },
  tapToChange: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 8
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4
  },
  userEmail: {
    fontSize: 14,
    color: '#666',
    marginLeft: 6
  },

  // Sections
  section: {
    marginBottom: 24
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4
  },
  menuGroup: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8eaed',
    overflow: 'hidden'
  },

  // Menu Items
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  menuContent: {
    flex: 1
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#666'
  },

  // Logout Button
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#dc2626',
    marginTop: 8
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
    marginLeft: 8
  }
});
