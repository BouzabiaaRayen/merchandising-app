import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { getStatusTone } from '../services/merchandisingAIMapper';

const TONE_STYLES = {
  success: {
    badgeBackground: '#dcfce7',
    badgeBorder: '#86efac',
    badgeText: '#166534',
  },
  caution: {
    badgeBackground: '#fef3c7',
    badgeBorder: '#fcd34d',
    badgeText: '#92400e',
  },
  warning: {
    badgeBackground: '#ffedd5',
    badgeBorder: '#fdba74',
    badgeText: '#9a3412',
  },
  danger: {
    badgeBackground: '#fee2e2',
    badgeBorder: '#fca5a5',
    badgeText: '#b91c1c',
  },
};

const formatConfidence = (confidence) => {
  if (!Number.isFinite(Number(confidence))) {
    return '0%';
  }

  const normalized = Number(confidence) <= 1 ? Number(confidence) * 100 : Number(confidence);
  return `${Math.round(normalized)}%`;
};

const formatHealthState = (healthState) => {
  if (healthState === 'healthy') {
    return {
      label: 'AI available',
      icon: 'check-decagram',
      color: '#166534',
      backgroundColor: '#dcfce7',
    };
  }

  if (healthState === 'error') {
    return {
      label: 'AI unavailable',
      icon: 'alert-circle-outline',
      color: '#b91c1c',
      backgroundColor: '#fee2e2',
    };
  }

  return {
    label: 'Checking AI',
    icon: 'progress-clock',
    color: '#92400e',
    backgroundColor: '#fef3c7',
  };
};

const getBoxStyle = (box, image, layoutWidth) => {
  if (!box || !layoutWidth) {
    return null;
  }

  const aspectRatio = image?.width && image?.height ? image.width / image.height : 4 / 3;
  const layoutHeight = layoutWidth / aspectRatio;
  const normalized = [box.x, box.y, box.width, box.height].every((value) => Number(value) >= 0 && Number(value) <= 1.2);

  if (normalized) {
    return {
      left: `${Math.max(0, Math.min(100, box.x * 100))}%`,
      top: `${Math.max(0, Math.min(100, box.y * 100))}%`,
      width: `${Math.max(0, Math.min(100, box.width * 100))}%`,
      height: `${Math.max(0, Math.min(100, box.height * 100))}%`,
    };
  }

  if (!image?.width || !image?.height) {
    return null;
  }

  return {
    left: Math.max(0, (box.x / image.width) * layoutWidth),
    top: Math.max(0, (box.y / image.height) * layoutHeight),
    width: Math.max(0, (box.width / image.width) * layoutWidth),
    height: Math.max(0, (box.height / image.height) * layoutHeight),
  };
};

export default function AIShelfAnalysisSection({
  pendingImage,
  analyzedImage,
  result,
  catalogProducts,
  loading,
  error,
  healthState,
  disabled,
  canUseCamera,
  showOverlay,
  hasStoreContext,
  isAdminMode,
  onPickImage,
  onCaptureImage,
  onAnalyze,
  onRetry,
  onToggleOverlay,
}) {
  const [imageLayoutWidth, setImageLayoutWidth] = useState(0);
  const [showRawDetails, setShowRawDetails] = useState(false);

  const previewImage = pendingImage || analyzedImage;
  const analysisImage = analyzedImage || pendingImage;
  const health = formatHealthState(healthState);
  const hasDetections = Boolean(result?.detections?.length);
  const normalizedCatalogProducts = useMemo(() => {
    if (!Array.isArray(catalogProducts)) {
      return [];
    }

    return catalogProducts.map((product) => ({
      ...product,
      normalizedName: String(product?.name || '').trim().toLowerCase(),
      normalizedMeta: String(product?.meta || '').trim().toLowerCase(),
    }));
  }, [catalogProducts]);
  const detectedProducts = useMemo(() => {
    if (!result || !result.products) {
      return [];
    }

    return result.products.filter((product) => Number(product?.detectedCount) > 0);
  }, [result]);
  const lectureProducts = useMemo(() => {
    const matchedProducts = [];
    const seenCatalogIds = new Set();

    detectedProducts.forEach((product, index) => {
      const detectedLabel = String(product?.productName || '').trim().toLowerCase();
      if (!detectedLabel) {
        return;
      }

      const catalogMatches = normalizedCatalogProducts.filter((catalogProduct) => (
        catalogProduct.normalizedName === detectedLabel ||
        catalogProduct.normalizedName.includes(detectedLabel) ||
        detectedLabel.includes(catalogProduct.normalizedName) ||
        catalogProduct.normalizedMeta.includes(detectedLabel)
      ));

      catalogMatches.forEach((catalogProduct) => {
        const catalogId = String(catalogProduct.id || `${detectedLabel}-${index}`);
        if (seenCatalogIds.has(catalogId)) {
          return;
        }

        seenCatalogIds.add(catalogId);
        matchedProducts.push({
          id: catalogId,
          productName: catalogProduct.name || product.productName || 'Unnamed product',
          detectedCount: Number(product.detectedCount || 0),
          stockStatus: String(catalogProduct.stockStatus || 'OUT OF STOCK').toUpperCase(),
          stockQuantity: Number(catalogProduct.stockQuantity || 0),
          meta: catalogProduct.meta || '',
        });
      });
    });

    return matchedProducts;
  }, [detectedProducts, normalizedCatalogProducts]);
  const hasProducts = lectureProducts.length > 0;
  const catalogStockSummary = useMemo(() => lectureProducts.reduce((summary, product) => {
    if (product.stockStatus === 'IN STOCK') {
      summary.inStock += 1;
      return summary;
    }

    summary.outOfStock += 1;
    return summary;
  }, {
    inStock: 0,
    outOfStock: 0,
  }), [lectureProducts]);

  const getCatalogStockPresentation = (stockStatus) => {
    if (stockStatus === 'IN STOCK') {
      return {
        label: 'In stock',
        containerStyle: styles.inStockBadge,
        textStyle: styles.inStockBadgeText,
      };
    }

    return {
      label: 'Out of stock',
      containerStyle: styles.outOfStockBadge,
      textStyle: styles.outOfStockBadgeText,
    };
  };

  return (
    <View style={styles.sectionWrap}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleWrap}>
            <Text style={styles.eyebrow}>NEW OUT-OF-STOCK FLOW</Text>
            <Text style={styles.title}>AI Shelf Analysis</Text>
            <Text style={styles.subtitle}>
              Capture the shelf, run the analysis, and use the AI result as your field stock reference.
            </Text>
          </View>
          <View style={[styles.healthBadge, { backgroundColor: health.backgroundColor }]}> 
            <MaterialCommunityIcons name={health.icon} size={14} color={health.color} />
            <Text style={[styles.healthBadgeText, { color: health.color }]}>{health.label}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.dropzone, disabled && styles.dropzoneDisabled]}
          activeOpacity={0.88}
          onPress={onPickImage}
          disabled={disabled}
        >
          {previewImage ? (
            <>
              <Image source={{ uri: previewImage.uri }} style={styles.dropzonePreview} />
              <View style={styles.dropzoneOverlay}>
                <View>
                  <Text style={styles.dropzonePreviewTitle}>
                    {pendingImage && analyzedImage ? 'New image ready' : 'Shelf image ready'}
                  </Text>
                  <Text style={styles.dropzonePreviewSubtitle}>
                    {pendingImage && analyzedImage
                      ? 'The latest result stays visible until the next analysis.'
                      : 'Tap to replace the photo or capture a new view.'}
                  </Text>
                </View>
                <MaterialCommunityIcons name="image-edit-outline" size={22} color="#ffffff" />
              </View>
            </>
          ) : (
            <>
              <View style={styles.dropzoneIconWrap}>
                <MaterialCommunityIcons name="image-search-outline" size={34} color="#2563eb" />
              </View>
              <Text style={styles.dropzoneTitle}>Add a shelf photo</Text>
              <Text style={styles.dropzoneSubtitle}>
                Upload from the gallery or capture on site, then analyze the visible products automatically.
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.secondaryAction, disabled && styles.secondaryActionDisabled]}
            onPress={onPickImage}
            disabled={disabled}
          >
            <MaterialCommunityIcons name="upload-outline" size={18} color={disabled ? '#94a3b8' : '#2563eb'} />
            <Text style={[styles.secondaryActionText, disabled && styles.secondaryActionTextDisabled]}>Upload</Text>
          </TouchableOpacity>

          {canUseCamera && (
            <TouchableOpacity
              style={[styles.secondaryAction, disabled && styles.secondaryActionDisabled]}
              onPress={onCaptureImage}
              disabled={disabled}
            >
              <MaterialCommunityIcons name="camera-outline" size={18} color={disabled ? '#94a3b8' : '#2563eb'} />
              <Text style={[styles.secondaryActionText, disabled && styles.secondaryActionTextDisabled]}>Camera</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, (!previewImage || disabled || loading) && styles.primaryButtonDisabled]}
          onPress={onAnalyze}
          disabled={!previewImage || disabled || loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <MaterialCommunityIcons name="radar" size={18} color="#ffffff" />
          )}
          <Text style={styles.primaryButtonText}>
            {loading ? 'Analysis in progress...' : result ? 'Run analysis again' : 'Start AI analysis'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.feedbackCard}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.feedbackTitle}>Analysis in progress...</Text>
          <Text style={styles.feedbackText}>The AI engine is checking visible products and calculating shelf stock status.</Text>
        </View>
      )}

      {!!error && (
        <View style={[styles.feedbackCard, styles.errorCard]}>
          <View style={styles.feedbackIconRow}>
            <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#b91c1c" />
            <Text style={styles.errorTitle}>Analysis interrupted</Text>
          </View>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRetry} disabled={!previewImage || loading}>
            <MaterialCommunityIcons name="refresh" size={16} color="#ffffff" />
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {result && (
        <View style={styles.resultsCard}>
          <View style={styles.resultsHeader}>
            <View>
              <Text style={styles.resultsTitle}>Analysis result</Text>
              <Text style={styles.resultsSubtitle}>AI reading ready to use for the current visit.</Text>
            </View>
            {hasDetections && (
              <TouchableOpacity style={styles.overlayToggle} onPress={onToggleOverlay}>
                <MaterialCommunityIcons name={showOverlay ? 'layers-off-outline' : 'layers-outline'} size={16} color="#2563eb" />
                <Text style={styles.overlayToggleText}>{showOverlay ? 'Hide overlay' : 'Show overlay'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {hasStoreContext && (
            <View style={styles.storeComparisonBadge}>
              <MaterialCommunityIcons name="store-check-outline" size={15} color="#1d4ed8" />
              <Text style={styles.storeComparisonText}>Compare with store stock</Text>
            </View>
          )}

          {analysisImage && (
            <View
              style={styles.analysisImageWrap}
              onLayout={(event) => setImageLayoutWidth(event.nativeEvent.layout.width)}
            >
              <Image
                source={{ uri: analysisImage.uri }}
                style={[
                  styles.analysisImage,
                  { aspectRatio: analysisImage.width && analysisImage.height ? analysisImage.width / analysisImage.height : 4 / 3 },
                ]}
              />
              {showOverlay && hasDetections && result.detections.map((detection) => {
                const boxStyle = getBoxStyle(detection.box, analysisImage, imageLayoutWidth);
                if (!boxStyle) {
                  return null;
                }

                return (
                  <View key={detection.id} style={[styles.detectionBox, boxStyle]}>
                    <View style={styles.detectionLabel}>
                      <Text style={styles.detectionLabelText} numberOfLines={1}>
                        {detection.label}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.productsBlock}>
            <Text style={styles.blockTitle}>Product reading</Text>
            {!hasProducts ? (
              <View style={styles.emptyStateCard}>
                <MaterialCommunityIcons name="package-variant-remove" size={28} color="#94a3b8" />
                <Text style={styles.emptyStateTitle}>No products detected</Text>
                <Text style={styles.emptyStateText}>Try a clearer photo or run the analysis again with a wider frame.</Text>
              </View>
            ) : (
              <>
                <View style={styles.stockSummaryRow}>
                  <View style={[styles.stockSummaryCard, styles.stockSummaryInStock]}>
                    <Text style={styles.stockSummaryValue}>{catalogStockSummary.inStock}</Text>
                    <Text style={styles.stockSummaryLabel}>Detected and in stock</Text>
                  </View>
                  <View style={[styles.stockSummaryCard, styles.stockSummaryOutOfStock]}>
                    <Text style={styles.stockSummaryValue}>{catalogStockSummary.outOfStock}</Text>
                    <Text style={styles.stockSummaryLabel}>Detected and out of stock</Text>
                  </View>
                </View>
                <View style={styles.productList}>
                  {lectureProducts.map((product) => {
                    const stockPresentation = getCatalogStockPresentation(product.stockStatus);

                    return (
                      <View key={product.id} style={styles.productListItem}>
                        <View style={styles.productListItemContent}>
                          <Text style={styles.productListItemName}>{product.productName || 'Unnamed product'}</Text>
                        </View>
                        <View style={styles.productListItemRight}>
                          <View style={[styles.stockStatusBadge, stockPresentation.containerStyle]}>
                            <Text style={[styles.stockStatusBadgeText, stockPresentation.textStyle]}>
                              {stockPresentation.label} {product.stockQuantity}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {isAdminMode && (
            <View style={styles.debugBlock}>
              <TouchableOpacity style={styles.debugToggle} onPress={() => setShowRawDetails((current) => !current)}>
                <MaterialCommunityIcons name={showRawDetails ? 'chevron-up' : 'chevron-down'} size={18} color="#334155" />
                <Text style={styles.debugToggleText}>Raw AI details</Text>
              </TouchableOpacity>
              {showRawDetails && (
                <View style={styles.debugPanel}>
                  <Text style={styles.debugText}>{JSON.stringify(result.raw, null, 2)}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionWrap: {
    marginBottom: 18,
  },
  heroCard: {
    backgroundColor: '#f8fbff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginBottom: 14,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  heroTitleWrap: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563eb',
    letterSpacing: 1,
    marginBottom: 6,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#475569',
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 99,
  },
  healthBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dropzone: {
    position: 'relative',
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    borderColor: '#c7d2fe',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dropzoneDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  dropzoneIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 99,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  dropzoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  dropzoneSubtitle: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    maxWidth: '90%',
  },
  dropzonePreview: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  dropzoneOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  dropzonePreviewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  dropzonePreviewSubtitle: {
    fontSize: 12,
    color: '#e2e8f0',
    maxWidth: '95%',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  secondaryActionDisabled: {
    opacity: 0.5,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563eb',
  },
  secondaryActionTextDisabled: {
    color: '#94a3b8',
  },
  advancedPanel: {
    backgroundColor: '#eef2ff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    gap: 12,
  },
  advancedField: {
    flex: 1,
  },
  advancedLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  advancedInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#111827',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 99,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#94a3b8',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  feedbackCard: {
    backgroundColor: '#f8fbff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center',
    marginBottom: 14,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e3a8a',
    marginTop: 14,
    marginBottom: 6,
  },
  feedbackText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
  errorCard: {
    backgroundColor: '#fff1f2',
    borderColor: '#fecaca',
  },
  feedbackIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#b91c1c',
  },
  errorText: {
    fontSize: 14,
    color: '#991b1b',
    textAlign: 'center',
    lineHeight: 20,
    marginVertical: 12,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    borderRadius: 99,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  resultsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  resultsSubtitle: {
    fontSize: 14,
    color: '#475569',
  },
  overlayToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#eef2ff',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 99,
  },
  overlayToggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
  },
  storeComparisonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e0e7ff',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 99,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  storeComparisonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1d4ed8',
  },
  analysisImageWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  analysisImage: {
    width: '100%',
    height: undefined,
  },
  detectionBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(37, 99, 235, 0.8)',
    borderRadius: 4,
  },
  detectionLabel: {
    position: 'absolute',
    top: -20,
    left: -2,
    backgroundColor: 'rgba(37, 99, 235, 0.8)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  detectionLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 99,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
  },
  productsBlock: {
    marginBottom: 18,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  emptyStateCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateText: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  stockSummaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  stockSummaryCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  stockSummaryInStock: {
    backgroundColor: '#dcfce7',
  },
  stockSummaryOutOfStock: {
    backgroundColor: '#fee2e2',
  },
  stockSummaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  stockSummaryLabel: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  productList: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 12,
  },
  productListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  productListItemContent: {
    flex: 1,
    paddingRight: 12,
  },
  productListItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  productListItemRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  stockStatusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  stockStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  inStockBadge: {
    backgroundColor: '#dcfce7',
  },
  inStockBadgeText: {
    color: '#166534',
  },
  outOfStockBadge: {
    backgroundColor: '#fee2e2',
  },
  outOfStockBadgeText: {
    color: '#b91c1c',
  },
  debugBlock: {
    marginTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 14,
  },
  debugToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  debugToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  debugPanel: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 12,
  },
  debugText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: '#475569',
  },
});