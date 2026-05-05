const STATUS_LABELS = {
  'IN STOCK': 'IN STOCK',
  'LAST ITEMS': 'LAST ITEMS',
  'NOT ON SHELF (RESTOCK NEEDED)': 'NOT ON SHELF (RESTOCK NEEDED)',
  'OUT OF STOCK': 'OUT OF STOCK',
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null && value !== '');

const normalizeStatus = (status, detectedCount, storageCount) => {
  const normalized = String(status || '').trim().toUpperCase();

  if (STATUS_LABELS[normalized]) {
    return normalized;
  }

  if (detectedCount <= 0 && storageCount > 0) {
    return 'NOT ON SHELF (RESTOCK NEEDED)';
  }

  if (detectedCount <= 0) {
    return 'OUT OF STOCK';
  }

  if (storageCount > 0 && detectedCount < storageCount) {
    return 'LAST ITEMS';
  }

  if (detectedCount <= 2) {
    return 'LAST ITEMS';
  }

  return 'IN STOCK';
};

const normalizeBox = (boxLike) => {
  if (!boxLike) return null;

  if (Array.isArray(boxLike) && boxLike.length >= 4) {
    const [x1, y1, x2, y2] = boxLike.map((value) => toNumber(value));
    return {
      x: x1,
      y: y1,
      width: Math.max(0, x2 - x1),
      height: Math.max(0, y2 - y1),
    };
  }

  const left = toNumber(firstDefined(boxLike.x, boxLike.left, boxLike.x1));
  const top = toNumber(firstDefined(boxLike.y, boxLike.top, boxLike.y1));
  const right = firstDefined(boxLike.right, boxLike.x2);
  const bottom = firstDefined(boxLike.bottom, boxLike.y2);
  const width = firstDefined(boxLike.width, right !== undefined ? toNumber(right) - left : undefined);
  const height = firstDefined(boxLike.height, bottom !== undefined ? toNumber(bottom) - top : undefined);

  if (!Number.isFinite(left) || !Number.isFinite(top) || !Number.isFinite(toNumber(width)) || !Number.isFinite(toNumber(height))) {
    return null;
  }

  return {
    x: left,
    y: top,
    width: Math.max(0, toNumber(width)),
    height: Math.max(0, toNumber(height)),
  };
};

const groupDetectionsByProduct = (detections) => {
  const grouped = new Map();

  detections.forEach((detection) => {
    const key = detection.productName || detection.label || 'Produit non identifie';
    if (!grouped.has(key)) {
      grouped.set(key, {
        productName: key,
        detectedCount: 0,
        storageCount: 0,
        status: 'IN STOCK',
      });
    }
    const entry = grouped.get(key);
    entry.detectedCount += 1;
  });

  return Array.from(grouped.values());
};

export const normalizeDetection = (detection, index = 0) => {
  const label = firstDefined(
    detection?.product_name,
    detection?.product,
    detection?.name,
    detection?.label,
    detection?.class_name,
    detection?.class,
    detection?.category,
    `Detection ${index + 1}`
  );

  return {
    id: String(firstDefined(detection?.id, detection?.tracking_id, `${label}-${index}`)),
    label,
    productName: label,
    confidence: toNumber(firstDefined(detection?.confidence, detection?.score, detection?.probability), 0),
    box: normalizeBox(firstDefined(detection?.bbox, detection?.box, detection?.xyxy, detection?.coordinates, detection?.rect)),
    raw: detection,
  };
};

export const normalizeAiDetectionResponse = (payload = {}) => {
  const summary = payload?.summary || {};
  const detections = Array.isArray(payload?.detections)
    ? payload.detections.map((detection, index) => normalizeDetection(detection, index))
    : [];

  const groupedDetections = groupDetectionsByProduct(detections);
  const rawProducts = Array.isArray(payload?.products) ? payload.products : [];

  const mergedProducts = new Map();

  rawProducts.forEach((product, index) => {
    const productName = firstDefined(product?.product_name, product?.name, product?.label, product?.product, `Produit ${index + 1}`);
    const detectedCount = toNumber(firstDefined(product?.detected_count, product?.count, product?.observed_count, product?.shelf_count));
    const storageCount = toNumber(firstDefined(product?.storage_count, product?.store_count, product?.inventory_count, product?.expected_count));
    const status = normalizeStatus(firstDefined(product?.status, product?.stock_status, product?.computed_status), detectedCount, storageCount);

    mergedProducts.set(productName, {
      id: String(firstDefined(product?.id, productName)),
      productName,
      detectedCount,
      storageCount,
      status,
      raw: product,
    });
  });

  groupedDetections.forEach((groupedProduct) => {
    const existing = mergedProducts.get(groupedProduct.productName);
    if (existing) {
      const detectedCount = existing.detectedCount || groupedProduct.detectedCount;
      const storageCount = existing.storageCount;
      mergedProducts.set(groupedProduct.productName, {
        ...existing,
        detectedCount,
        status: normalizeStatus(existing.status, detectedCount, storageCount),
      });
      return;
    }

    mergedProducts.set(groupedProduct.productName, {
      id: groupedProduct.productName,
      productName: groupedProduct.productName,
      detectedCount: groupedProduct.detectedCount,
      storageCount: 0,
      status: normalizeStatus(undefined, groupedProduct.detectedCount, 0),
      raw: null,
    });
  });

  const products = Array.from(mergedProducts.values()).sort((left, right) => {
    const severityOrder = {
      'OUT OF STOCK': 0,
      'NOT ON SHELF (RESTOCK NEEDED)': 1,
      'LAST ITEMS': 2,
      'IN STOCK': 3,
    };

    const severityDelta = (severityOrder[left.status] ?? 99) - (severityOrder[right.status] ?? 99);
    if (severityDelta !== 0) {
      return severityDelta;
    }

    return left.productName.localeCompare(right.productName);
  });

  const urgentCount = products.filter((product) => product.status !== 'IN STOCK').length;
  const outOfStockCount = products.filter((product) => product.status === 'OUT OF STOCK').length;
  const restockCount = products.filter((product) => product.status === 'NOT ON SHELF (RESTOCK NEEDED)').length;

  return {
    summary: {
      totalProducts: toNumber(firstDefined(summary?.total_products, summary?.products_count), products.length),
      totalDetections: toNumber(firstDefined(summary?.total_detections, summary?.detections_count), detections.length),
      urgentCount: toNumber(firstDefined(summary?.urgent_count), urgentCount),
      outOfStockCount: toNumber(firstDefined(summary?.out_of_stock_count), outOfStockCount),
      restockCount: toNumber(firstDefined(summary?.restock_count, summary?.not_on_shelf_count), restockCount),
      raw: summary,
    },
    products,
    detections,
    raw: payload,
  };
};

export const getStockRupturesFromAiResult = (result) => {
  if (!result?.products?.length) {
    return [];
  }

  return result.products
    .filter((product) => product.status !== 'IN STOCK')
    .map((product) => ({
      productId: product.id,
      productName: product.productName,
      status: product.status,
      detectedCount: product.detectedCount,
      storageCount: product.storageCount,
    }));
};

export const getStatusTone = (status) => {
  switch (status) {
    case 'OUT OF STOCK':
      return 'danger';
    case 'NOT ON SHELF (RESTOCK NEEDED)':
      return 'warning';
    case 'LAST ITEMS':
      return 'caution';
    default:
      return 'success';
  }
};
