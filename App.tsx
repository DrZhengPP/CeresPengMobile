import { useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFonts } from 'expo-font';

const Geist_600SemiBold = require('@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf');
import CeresLogo from './components/CeresLogo';
import PartnerDropdown, { Selection } from './components/PartnerDropdown';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

// Convert ArrayBuffer → base64 string (React Native has no Buffer, btoa is available)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Process in 32 KB chunks to avoid stack overflow with spread operator
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...(bytes.subarray(i, i + CHUNK) as unknown as number[]));
  }
  return btoa(binary);
}

// ── Leaflet map HTML (all layer rendering happens via injected JS) ─────────────
const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #1a1a2e; }
    .leaflet-control-attribution { font-size: 9px; }
    .polygon-label {
      background: transparent; border: none; box-shadow: none;
      font-size: 11px; font-weight: bold; color: #fff;
      text-shadow: 0 0 3px #000, 0 0 3px #000;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      center: [20, 0], zoom: 3, zoomControl: false, attributionControl: true,
    });
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics' }
    ).addTo(map);

    var shapeLayer = null;
    var imageLayers = [];
    var polygonId = null;

    function clearLayers() {
      if (shapeLayer) { map.removeLayer(shapeLayer); shapeLayer = null; }
      imageLayers.forEach(function(l) { map.removeLayer(l); });
      imageLayers = [];
      polygonId = null;
    }

    // Step 1: receive GeoJSON from RN, render polygons, fly to bounds
    function loadGeoJSON(jsonStr) {
      var geojson = JSON.parse(jsonStr);
      clearLayers();
      polygonId = geojson.polygon_id || null;

      shapeLayer = L.geoJSON(geojson, {
        style: { color: '#ff4444', weight: 2, fillColor: 'transparent', fillOpacity: 0 },
        onEachFeature: function(feature, layer) {
          var label = polygonId && feature.properties
            ? String(feature.properties[polygonId] || '') : '';
          if (label) {
            layer.bindTooltip(label, {
              permanent: true, direction: 'center', className: 'polygon-label',
            });
          }
        },
      }).addTo(map);

      // invalidateSize first, then fitBounds after a short delay so Leaflet
      // has the correct container dimensions
      map.invalidateSize();
      setTimeout(function() {
        var bounds = shapeLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
        }
      }, 150);
    }

    // Step 2: receive pre-fetched images as base64 data URIs from RN
    function loadImages(jsonStr) {
      var images = JSON.parse(jsonStr); // [{label, dataUri}]
      if (!shapeLayer) return;

      images.forEach(function(img) {
        shapeLayer.eachLayer(function(layer) {
          if (!layer.feature || !layer.feature.properties) return;
          var featureLabel = polygonId
            ? String(layer.feature.properties[polygonId] || '').trim()
            : '';
          if (featureLabel.toLowerCase() !== img.label.toLowerCase()) return;

          var bounds = layer.getBounds();
          if (!bounds.isValid()) return;

          var overlay = L.imageOverlay(img.dataUri, bounds, { opacity: 1, interactive: false });
          overlay.addTo(map);
          imageLayers.push(overlay);
        });
      });
    }

    function clearSelection() {
      clearLayers();
      map.setView([20, 0], 3);
    }
  </script>
</body>
</html>`;

export default function App() {
  const [fontsLoaded] = useFonts({ Geist_600SemiBold });
  const webviewRef = useRef<WebView>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSelect(sel: Selection) {
    setStatus('Loading shapefile…');

    try {
      // ── 1. Fetch shapefile in RN (guaranteed network access) ──────────────
      const shapeRes = await fetch(
        `${API_URL}/api/shapefile/${encodeURIComponent(sel.farm)}`
      );
      const geojson = await shapeRes.json();

      // Inject GeoJSON → WebView renders polygons and pans immediately
      webviewRef.current?.injectJavaScript(
        `loadGeoJSON(${JSON.stringify(JSON.stringify(geojson))}); true;`
      );

      // ── 2. Fetch image list ───────────────────────────────────────────────
      setStatus('Loading images…');
      const imgListRes = await fetch(
        `${API_URL}/api/images/${encodeURIComponent(sel.farm)}` +
        `/${encodeURIComponent(sel.date)}/${encodeURIComponent(sel.product)}`
      );
      const imgList: { label: string; url: string }[] = await imgListRes.json();

      if (imgList.length === 0) {
        setStatus(null);
        return;
      }

      // ── 3. Fetch all images in parallel → base64 data URIs ───────────────
      setStatus(`Fetching ${imgList.length} images…`);
      const imageData = await Promise.all(
        imgList.map(async (img) => {
          const r = await fetch(`${API_URL}${img.url}`);
          const buf = await r.arrayBuffer();
          const dataUri = `data:image/png;base64,${arrayBufferToBase64(buf)}`;
          return { label: img.label, dataUri };
        })
      );

      // ── 4. Inject image data URIs into WebView ───────────────────────────
      webviewRef.current?.injectJavaScript(
        `loadImages(${JSON.stringify(JSON.stringify(imageData))}); true;`
      );
      setStatus(null);

    } catch (e) {
      console.error('handleSelect error:', e);
      setStatus(null);
    }
  }

  function handleClear() {
    webviewRef.current?.injectJavaScript(`clearSelection(); true;`);
    setStatus(null);
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <WebView
        ref={webviewRef}
        style={styles.map}
        source={{ html: MAP_HTML }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        androidLayerType="hardware"
        mixedContentMode="always"
      />
      {status !== null && (
        <View style={styles.statusBadge}>
          <ActivityIndicator size="small" color="#ffffff" />
          <Text style={styles.statusText}>{status}</Text>
        </View>
      )}
      <View style={styles.menu}>
        <View style={styles.brand}>
          <CeresLogo size={30} />
          <Text style={[styles.title, fontsLoaded && { fontFamily: 'Geist_600SemiBold' }]}>
            Vulcan CeresPeng
          </Text>
        </View>
        <View style={styles.divider} />
        <PartnerDropdown onSelect={handleSelect} onClear={handleClear} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 11 },
  statusBadge: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  statusText: { color: '#ffffff', fontSize: 13 },
  menu: {
    flex: 1,
    maxHeight: 60,
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  title: { fontSize: 16, fontWeight: '600', color: '#111827' },
  divider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: '#e5e7eb' },
});
