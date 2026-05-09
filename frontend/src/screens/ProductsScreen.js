import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { productService } from '../services/apiService';

const formatPrice = (value) => `${Number(value || 0).toFixed(3)} TND`;

export default function ProductsScreen() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await productService.getProducts();
      setProducts(data.results || data);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch products');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const renderProduct = ({ item }) => (
    <View style={styles.productCard}>
      <View style={styles.cardTopRow}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.productImage} />
        ) : (
          <View style={styles.productImagePlaceholder}>
            <Text style={styles.productImagePlaceholderText}>IMG</Text>
          </View>
        )}

        <View style={styles.productInfo}>
          <Text style={styles.productName}>{item.name}</Text>
          <Text style={styles.productMeta}>{item.brand_name || 'No brand'} • {item.category_name || 'No category'}</Text>
          <Text style={styles.productCode}>{item.barcode || item.sku || 'No barcode / SKU'}</Text>
        </View>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailPill}>
          <Text style={styles.detailLabel}>Price</Text>
          <Text style={styles.productPrice}>{formatPrice(item.price)}</Text>
        </View>
        <View style={styles.detailPill}>
          <Text style={styles.detailLabel}>Facing</Text>
          <Text style={styles.detailValue}>{item.recommended_facing || 0}</Text>
        </View>
      </View>

      {!!item.description && <Text style={styles.productDescription}>{item.description}</Text>}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        renderItem={renderProduct}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No products found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 15,
  },
  productCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  productImage: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    marginRight: 14,
  },
  productImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  productImagePlaceholderText: {
    color: '#64748b',
    fontWeight: '700',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  productMeta: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  productCode: {
    fontSize: 13,
    color: '#94a3b8',
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  detailPill: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  detailLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  productDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});
