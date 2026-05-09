import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Animated,
  Easing,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { productService } from '../services/apiService';

const ANOMALY_CATEGORIES = [
  { key: 'Wrong Placement', label: 'Wrong Placement', icon: 'arrow-decision' },
  { key: 'Low Facing', label: 'Low Facing', icon: 'format-horizontal-align-bottom' },
  { key: 'Disorganized Shelf', label: 'Disorganized Shelf', icon: 'view-grid-plus-outline' },
  { key: 'Bad Positioning', label: 'Bad Positioning', icon: 'map-marker-alert-outline' },
  { key: 'Damaged Product', label: 'Damaged Product', icon: 'alert-octagon-outline' },
  { key: 'Pricing Issue', label: 'Pricing Issue', icon: 'cash-remove' },
  { key: 'Cleanliness Issue', label: 'Cleanliness Issue', icon: 'broom' },
  { key: 'Other', label: 'Other', icon: 'dots-horizontal' },
];

export default function ReportAnomalyScreen({ route, navigation }) {
  const { visitId } = route.params || {};
  const [category, setCategory] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownAnim] = useState(new Animated.Value(0));
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productDropdownOpen, setProductDropdownOpen] = useState(false);
  const [photoBefore, setPhotoBefore] = useState(null);
  const [photoAfter, setPhotoAfter] = useState(null);
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setProductsLoading(true);
        const response = await productService.getProducts({ page_size: 1000, is_active: true });
        setProducts(response.results || response);
      } catch (fetchError) {
        console.error('Failed to fetch anomaly products:', fetchError);
        setError('Failed to load products.');
      } finally {
        setProductsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const pickImage = async (setter) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setter(result.assets[0]);
    }
  };

  const takePhoto = async (setter) => {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setter(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!category || !photoBefore || !photoAfter) {
      setError('Before and After photos are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        visit_id: visitId,
        event_type: 'anomaly',
        category: category?.label || '',
        product_id: selectedProduct?.id || null,
        product_name: selectedProduct?.name || '',
        photo_before: photoBefore.base64 || photoBefore.uri,
        photo_after: photoAfter.base64 || photoAfter.uri,
        description,
        created_at: new Date().toISOString(),
      };
      console.log('Anomaly payload:', payload);
      setSubmitting(false);
      navigation.goBack();
    } catch (e) {
      setSubmitting(false);
      setError('Failed to submit anomaly. Please try again.');
    }
  };

  const openDropdown = () => {
    setDropdownOpen(true);
    Animated.timing(dropdownAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: false,
      easing: Easing.out(Easing.ease),
    }).start();
  };

  const closeDropdown = () => {
    Animated.timing(dropdownAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
      easing: Easing.in(Easing.ease),
    }).start(() => setDropdownOpen(false));
  };

  const handleSelectCategory = (cat) => {
    setCategory(cat);
    closeDropdown();
  };

  const dropdownHeight = dropdownAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, ANOMALY_CATEGORIES.length * 52],
  });

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Report Anomaly</Text>

      <Text style={styles.label}>
        Category <Text style={styles.required}>*</Text>
      </Text>

      <View style={{ zIndex: 10 }}>
        <TouchableOpacity
          style={styles.selectorRow}
          activeOpacity={0.85}
          onPress={() => (dropdownOpen ? closeDropdown() : openDropdown())}
        >
          <MaterialCommunityIcons
            name={category?.icon || 'shape-outline'}
            size={22}
            color={category ? '#2563eb' : '#9ca3af'}
            style={{ marginRight: 10 }}
          />
          <Text
            style={[
              styles.selectorText,
              !category && { color: '#9ca3af', fontWeight: '400' },
            ]}
          >
            {category?.label || 'Select a category...'}
          </Text>
          <View style={{ flex: 1 }} />
          <MaterialCommunityIcons
            name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
            size={22}
            color="#6b7280"
          />
        </TouchableOpacity>

        {dropdownOpen && (
          <Animated.View
            style={[
              styles.dropdownList,
              { height: dropdownHeight, overflow: 'hidden' },
            ]}
          >
            {ANOMALY_CATEGORIES.map((cat, idx) => (
              <React.Fragment key={cat.key}>
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    category?.key === cat.key && styles.dropdownItemSelected,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => handleSelectCategory(cat)}
                >
                  <MaterialCommunityIcons
                    name={cat.icon}
                    size={20}
                    color={category?.key === cat.key ? '#2563eb' : '#6b7280'}
                    style={{ marginRight: 12 }}
                  />
                  <Text
                    style={[
                      styles.dropdownItemText,
                      category?.key === cat.key && {
                        color: '#2563eb',
                        fontWeight: '700',
                      },
                    ]}
                  >
                    {cat.label}
                  </Text>
                  <View style={{ flex: 1 }} />
                  {category?.key === cat.key && (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={20}
                      color="#2563eb"
                    />
                  )}
                </TouchableOpacity>
                {idx < ANOMALY_CATEGORIES.length - 1 && (
                  <View style={styles.dropdownDivider} />
                )}
              </React.Fragment>
            ))}
          </Animated.View>
        )}
      </View>

      <View style={styles.photosRow}>
        <View style={styles.photoField}>
          <Text style={styles.label}>
            Before <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.photoPicker}
            onPress={() => pickImage(setPhotoBefore)}
          >
            {photoBefore ? (
              <Image
                source={{ uri: photoBefore.uri }}
                style={styles.photoPreview}
              />
            ) : (
              <MaterialCommunityIcons
                name="camera-plus-outline"
                size={36}
                color="#9ca3af"
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.photoAction}
            onPress={() => takePhoto(setPhotoBefore)}
          >
            <Text style={styles.photoActionText}>Take Photo</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.photoField}>
          <Text style={styles.label}>
            After <Text style={styles.required}>*</Text>
          </Text>
          <TouchableOpacity
            style={styles.photoPicker}
            onPress={() => pickImage(setPhotoAfter)}
          >
            {photoAfter ? (
              <Image
                source={{ uri: photoAfter.uri }}
                style={styles.photoPreview}
              />
            ) : (
              <MaterialCommunityIcons
                name="camera-plus-outline"
                size={36}
                color="#9ca3af"
              />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.photoAction}
            onPress={() => takePhoto(setPhotoAfter)}
          >
            <Text style={styles.photoActionText}>Take Photo</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.label}>Affected Product</Text>
      <View style={{ zIndex: 9 }}>
        <TouchableOpacity
          style={styles.selectorRow}
          activeOpacity={0.85}
          onPress={() => setProductDropdownOpen((current) => !current)}
        >
          <MaterialCommunityIcons
            name="package-variant-closed"
            size={22}
            color={selectedProduct ? '#2563eb' : '#9ca3af'}
            style={{ marginRight: 10 }}
          />
          <Text
            style={[
              styles.selectorText,
              !selectedProduct && { color: '#9ca3af', fontWeight: '400' },
            ]}
          >
            {selectedProduct
              ? `${selectedProduct.name}${selectedProduct.brand_name ? ` • ${selectedProduct.brand_name}` : ''}`
              : productsLoading
                ? 'Loading products...'
                : 'Select a product...'}
          </Text>
          <View style={{ flex: 1 }} />
          <MaterialCommunityIcons
            name={productDropdownOpen ? 'chevron-up' : 'chevron-down'}
            size={22}
            color="#6b7280"
          />
        </TouchableOpacity>

        {productDropdownOpen && !productsLoading && (
          <View style={styles.dropdownList}>
            {products.length === 0 ? (
              <View style={styles.emptyDropdownItem}>
                <Text style={styles.emptyDropdownText}>No active products found.</Text>
              </View>
            ) : (
              products.map((product, idx) => (
                <React.Fragment key={product.id}>
                  <TouchableOpacity
                    style={[
                      styles.dropdownItem,
                      selectedProduct?.id === product.id && styles.dropdownItemSelected,
                    ]}
                    activeOpacity={0.85}
                    onPress={() => {
                      setSelectedProduct(product);
                      setProductDropdownOpen(false);
                    }}
                  >
                    <MaterialCommunityIcons
                      name="package-variant-closed"
                      size={20}
                      color={selectedProduct?.id === product.id ? '#2563eb' : '#6b7280'}
                      style={{ marginRight: 12 }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.dropdownItemText,
                          selectedProduct?.id === product.id && styles.dropdownItemTextSelected,
                        ]}
                      >
                        {product.name}
                      </Text>
                      <Text style={styles.dropdownItemMeta}>
                        {[product.brand_name, product.category_name].filter(Boolean).join(' • ') || 'Central catalog product'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {idx < products.length - 1 && <View style={styles.dropdownDivider} />}
                </React.Fragment>
              ))
            )}
          </View>
        )}
      </View>

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.textArea}
        value={description}
        onChangeText={setDescription}
        placeholder="Describe the anomaly (optional)"
        placeholderTextColor="#9ca3af"
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[
          styles.submitBtn,
          (!category || !photoBefore || !photoAfter || submitting) &&
            styles.submitBtnDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!category || !photoBefore || !photoAfter || submitting}
        activeOpacity={0.9}
      >
        <MaterialCommunityIcons
          name="check-circle-outline"
          size={20}
          color="#fff"
          style={{ marginRight: 8 }}
        />
        <Text style={styles.submitBtnText}>
          {submitting ? 'Submitting...' : 'Submit'}
        </Text>
      </TouchableOpacity>

      {(!photoBefore || !photoAfter) && (
        <Text style={styles.helperText}>
          Both photos are required before submitting
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8fafc',
    flexGrow: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#1f2937',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 8,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  required: {
    color: '#dc2626',
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  selectorText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
  },
  dropdownList: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: -14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  dropdownItemSelected: {
    backgroundColor: '#eff6ff',
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '500',
  },
  dropdownItemTextSelected: {
    color: '#2563eb',
    fontWeight: '700',
  },
  dropdownItemMeta: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginLeft: 48,
  },
  emptyDropdownItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyDropdownText: {
    fontSize: 14,
    color: '#64748b',
  },
  photosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 14,
  },
  photoField: {
    flex: 1,
    alignItems: 'center',
  },
  photoPicker: {
    width: '100%',
    height: 140,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoAction: {
    marginBottom: 4,
  },
  photoActionText: {
    color: '#2563eb',
    fontSize: 13,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 14,
    padding: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 20,
    fontSize: 15,
    backgroundColor: '#fff',
    color: '#1f2937',
  },
  error: {
    color: '#dc2626',
    marginBottom: 12,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 13,
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    shadowColor: '#2563eb',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: '#93c5fd',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  helperText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 10,
  },
});