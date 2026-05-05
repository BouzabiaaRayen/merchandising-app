import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
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
      label: 'IA disponible',
      icon: 'check-decagram',
      color: '#166534',
      backgroundColor: '#dcfce7',
    };
  }

  if (healthState === 'error') {
    return {
      label: 'IA indisponible',
      icon: 'alert-circle-outline',
      color: '#b91c1c',
      backgroundColor: '#fee2e2',
    };
  }

  return {
    label: 'Verification IA',
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
  loading,
  error,
  healthState,
  disabled,
  canUseCamera,
  showAdvancedSettings,
  settings,
  showOverlay,
  hasStoreContext,
  isAdminMode,
  onPickImage,
  onCaptureImage,
  onAnalyze,
  onRetry,
  onToggleOverlay,
  onToggleAdvanced,
  onSettingsChange,
}) {
  const [imageLayoutWidth, setImageLayoutWidth] = useState(0);
  const [showRawDetails, setShowRawDetails] = useState(false);

  const previewImage = pendingImage || analyzedImage;
  const analysisImage = analyzedImage || pendingImage;
  const health = formatHealthState(healthState);
  const hasDetections = Boolean(result?.detections?.length);
  const hasProducts = Boolean(result?.products?.length);
  const summaryCards = useMemo(() => {
    if (!result) {
      return [];
    }

    return [
      {
        key: 'products',
        label: 'Produits identifies',
        value: result.summary.totalProducts,
        icon: 'package-variant-closed',
        accent: '#2563eb',
        background: '#dbeafe',
      },
      {
        key: 'urgent',
        label: 'Statuts urgents',
        value: result.summary.urgentCount,
        icon: 'alert-outline',
        accent: '#ea580c',
        background: '#ffedd5',
      },
      {
        key: 'detections',
        label: 'Detections IA',
        value: result.summary.totalDetections,
        icon: 'radar',
        accent: '#0f766e',
        background: '#ccfbf1',
      },
    ];
  }, [result]);

  return (
    <View style={styles.sectionWrap}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleWrap}>
            <Text style={styles.eyebrow}>NOUVEAU FLUX RUPTURE</Text>
            <Text style={styles.title}>Analyse IA Rayon</Text>
            <Text style={styles.subtitle}>
              Capturez le rayon, lancez l'analyse et utilisez le resultat IA comme reference stock terrain.
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
                    {pendingImage && analyzedImage ? 'Nouvelle image prete' : 'Image rayon prete'}
                  </Text>
                  <Text style={styles.dropzonePreviewSubtitle}>
                    {pendingImage && analyzedImage
                      ? 'Le dernier resultat reste affiche jusqu a la prochaine analyse.'
                      : 'Touchez pour changer la photo ou capturer une nouvelle vue.'}
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
              <Text style={styles.dropzoneTitle}>Ajouter une photo de rayon</Text>
              <Text style={styles.dropzoneSubtitle}>
                Galerie ou capture terrain, puis analyse automatique des produits visibles.
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
            <Text style={[styles.secondaryActionText, disabled && styles.secondaryActionTextDisabled]}>Importer</Text>
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

          <TouchableOpacity style={styles.secondaryAction} onPress={onToggleAdvanced}>
            <MaterialCommunityIcons name={showAdvancedSettings ? 'tune-off' : 'tune'} size={18} color="#2563eb" />
            <Text style={styles.secondaryActionText}>Parametres IA</Text>
          </TouchableOpacity>
        </View>

        {showAdvancedSettings && (
          <View style={styles.advancedPanel}>
            <View style={styles.advancedField}>
              <Text style={styles.advancedLabel}>Confidence</Text>
              <TextInput
                style={styles.advancedInput}
                value={settings.confidence}
                onChangeText={(value) => onSettingsChange('confidence', value.replace(',', '.').replace(/[^\d.]/g, ''))}
                placeholder="0.25"
                placeholderTextColor="#9ca3af"
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.advancedField}>
              <Text style={styles.advancedLabel}>Image size</Text>
              <TextInput
                style={styles.advancedInput}
                value={settings.imgsz}
                onChangeText={(value) => onSettingsChange('imgsz', value.replace(/[^\d]/g, ''))}
                placeholder="640"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
              />
            </View>
          </View>
        )}

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
            {loading ? 'Analyse en cours...' : result ? 'Relancer l\'analyse' : 'Lancer l\'analyse IA'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.feedbackCard}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.feedbackTitle}>Analyse en cours...</Text>
          <Text style={styles.feedbackText}>Le moteur IA verifie les produits visibles et calcule l'etat stock du rayon.</Text>
        </View>
      )}

      {!!error && (
        <View style={[styles.feedbackCard, styles.errorCard]}>
          <View style={styles.feedbackIconRow}>
            <MaterialCommunityIcons name="alert-circle-outline" size={22} color="#b91c1c" />
            <Text style={styles.errorTitle}>Analyse interrompue</Text>
          </View>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRetry} disabled={!previewImage || loading}>
            <MaterialCommunityIcons name="refresh" size={16} color="#ffffff" />
            <Text style={styles.retryButtonText}>Reessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {result && (
        <View style={styles.resultsCard}>
          <View style={styles.resultsHeader}>
            <View>
              <Text style={styles.resultsTitle}>Resultat d'analyse</Text>
              <Text style={styles.resultsSubtitle}>Lecture IA exploitable pour la visite en cours.</Text>
            </View>
            {hasDetections && (
              <TouchableOpacity style={styles.overlayToggle} onPress={onToggleOverlay}>
                <MaterialCommunityIcons name={showOverlay ? 'layers-off-outline' : 'layers-outline'} size={16} color="#2563eb" />
                <Text style={styles.overlayToggleText}>{showOverlay ? 'Masquer overlay' : 'Afficher overlay'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {hasStoreContext && (
            <View style={styles.storeComparisonBadge}>
              <MaterialCommunityIcons name="store-check-outline" size={15} color="#1d4ed8" />
              <Text style={styles.storeComparisonText}>Comparer avec le stock magasin</Text>
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

          <View style={styles.summaryGrid}>
            {summaryCards.map((card) => (
              <View key={card.key} style={styles.summaryCard}>
                <View style={[styles.summaryIconWrap, { backgroundColor: card.background }]}>
                  <MaterialCommunityIcons name={card.icon} size={18} color={card.accent} />
                </View>
                <Text style={styles.summaryValue}>{card.value}</Text>
                <Text style={styles.summaryLabel}>{card.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.productsBlock}>
            <Text style={styles.blockTitle}>Lecture produits</Text>
            {!hasProducts ? (
              <View style={styles.emptyStateCard}>
                <MaterialCommunityIcons name="package-variant-remove" size={28} color="#94a3b8" />
                <Text style={styles.emptyStateTitle}>Aucun produit detecte</Text>
                <Text style={styles.emptyStateText}>Essayez une photo plus nette ou relancez l'analyse avec un cadrage plus large.</Text>
              </View>
            ) : (
              result.products.map((product) => {
                const tone = getStatusTone(product.status);
                const toneStyle = TONE_STYLES[tone];

                return (
                  <View key={product.id} style={styles.productCard}>
                    <View style={styles.productHeader}>
                      <Text style={styles.productName}>{product.productName}</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            backgroundColor: toneStyle.badgeBackground,
                            borderColor: toneStyle.badgeBorder,
                          },
                        ]}
                      >
                        <Text style={[styles.statusBadgeText, { color: toneStyle.badgeText }]}>{product.status}</Text>
                      </View>
                    </View>
                    <View style={styles.productMetricsRow}>
                      <View style={styles.metricTile}>
                        <Text style={styles.metricValue}>{product.detectedCount}</Text>
                        <Text style={styles.metricLabel}>Detecte</Text>
                      </View>
                      <View style={styles.metricTile}>
                        <Text style={styles.metricValue}>{product.storageCount}</Text>
                        <Text style={styles.metricLabel}>Stock magasin</Text>
                      </View>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {hasDetections && (
            <View style={styles.productsBlock}>
              <Text style={styles.blockTitle}>Details detections</Text>
              {result.detections.map((detection) => (
                <View key={`detail-${detection.id}`} style={styles.detectionCard}>
                  <View style={styles.detectionCardHeader}>
                    <Text style={styles.detectionName}>{detection.label}</Text>
                    <View style={styles.confidenceBadge}>
                      <MaterialCommunityIcons name="signal" size={12} color="#1d4ed8" />
                      <Text style={styles.confidenceText}>{formatConfidence(detection.confidence)}</Text>
                    </View>
                  </View>
                  {!!detection.box && (
                    <Text style={styles.detectionMeta}>
                      x:{Math.round(detection.box.x)} y:{Math.round(detection.box.y)} w:{Math.round(detection.box.width)} h:{Math.round(detection.box.height)}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {isAdminMode && (
            <View style={styles.debugBlock}>
              <TouchableOpacity style={styles.debugToggle} onPress={() => setShowRawDetails((current) => !current)}>
                <MaterialCommunityIcons name={showRawDetails ? 'chevron-up' : 'chevron-down'} size={18} color="#334155" />
                <Text style={styles.debugToggleText}>Details IA bruts</Text>
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
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  healthBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  dropzone: {
    minHeight: 220,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#93c5fd',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  dropzoneDisabled: {
    opacity: 0.65,
  },
  dropzoneIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  dropzoneTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  dropzoneSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: '#64748b',
    textAlign: 'center',
    maxWidth: 280,
  },
  dropzonePreview: {
    width: '100%',
    height: 220,
    borderRadius: 18,
  },
  dropzoneOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.38)',
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  dropzonePreviewTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  dropzonePreviewSubtitle: {
    color: '#e2e8f0',
    fontSize: 12,
    maxWidth: 240,
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 14,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  secondaryActionDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  secondaryActionText: {
    color: '#1d4ed8',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryActionTextDisabled: {
    color: '#94a3b8',
  },
  advancedPanel: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  advancedField: {
    flex: 1,
  },
  advancedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    marginBottom: 6,
  },
  advancedInput: {
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#0f172a',
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  feedbackCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  feedbackTitle: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  feedbackText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    color: '#64748b',
    textAlign: 'center',
  },
  errorCard: {
    alignItems: 'stretch',
    borderColor: '#fecaca',
    backgroundColor: '#fff7f7',
  },
  feedbackIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#991b1b',
  },
  errorText: {
    marginTop: 10,
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 18,
    color: '#7f1d1d',
  },
  retryButton: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    backgroundColor: '#dc2626',
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  resultsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  resultsSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  overlayToggle: {
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overlayToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  storeComparisonBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  storeComparisonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  analysisImageWrap: {
    width: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#e2e8f0',
    marginBottom: 14,
  },
  analysisImage: {
    width: '100%',
  },
  detectionBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#22c55e',
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  detectionLabel: {
    position: 'absolute',
    top: -1,
    left: -1,
    backgroundColor: '#22c55e',
    paddingHorizontal: 6,
    paddingVertical: 3,
    maxWidth: 120,
  },
  detectionLabelText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: '800',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryCard: {
    width: '31%',
    backgroundColor: '#f8fafc',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 11,
    lineHeight: 15,
    color: '#64748b',
    fontWeight: '700',
  },
  productsBlock: {
    marginTop: 4,
    marginBottom: 8,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  emptyStateCard: {
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    padding: 18,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
    marginTop: 8,
    marginBottom: 6,
  },
  emptyStateText: {
    fontSize: 13,
    lineHeight: 18,
    color: '#64748b',
    textAlign: 'center',
  },
  productCard: {
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    marginBottom: 10,
  },
  productHeader: {
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  productName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  productMetricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricTile: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    padding: 12,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 3,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  detectionCard: {
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
  },
  detectionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  detectionName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  confidenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: '#eff6ff',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  detectionMeta: {
    marginTop: 8,
    fontSize: 12,
    color: '#64748b',
  },
  debugBlock: {
    marginTop: 10,
  },
  debugToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  debugToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  debugPanel: {
    borderRadius: 14,
    backgroundColor: '#0f172a',
    padding: 12,
  },
  debugText: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
  },
});