import { useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFonts } from 'expo-font';

const Geist_600SemiBold = require('@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf');
import CeresLogo from './components/CeresLogo';
import PartnerDropdown, { Selection } from './components/PartnerDropdown';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

// ── Leaflet map HTML ──────────────────────────────────────────────────────────
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
      background: transparent !important; border: none !important;
      box-shadow: none !important; font-size: 10px; font-weight: bold;
      color: #fff; text-shadow: 0 0 3px #000, 0 0 3px #000;
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
      { maxZoom: 19, attribution: 'Tiles &copy; Esri' }
    ).addTo(map);

    var shapeLayer = null;
    var imageLayers = [];
    var polygonId = null;
    // Map from normalised label → Leaflet layer, built when GeoJSON is loaded
    var labelToLayer = {};

    function clearLayers() {
      if (shapeLayer) { map.removeLayer(shapeLayer); shapeLayer = null; }
      imageLayers.forEach(function(l) { map.removeLayer(l); });
      imageLayers = [];
      polygonId = null;
      labelToLayer = {};
    }

    // Normalise a polygon field value the same way Python names image files:
    // spaces → underscores, then trim.
    function normalise(s) {
      return String(s || '').replace(/ /g, '_').trim();
    }

    // Step 1 – called from RN with stringified GeoJSON
    function loadGeoJSON(jsonStr) {
      var geojson = JSON.parse(jsonStr);
      clearLayers();
      polygonId = geojson.polygon_id || null;

      shapeLayer = L.geoJSON(geojson, {
        style: { color: '#ff4444', weight: 2, fillColor: 'transparent', fillOpacity: 0 },
        onEachFeature: function(feature, layer) {
          var raw = polygonId && feature.properties
            ? (feature.properties[polygonId] || '') : '';
          var label = String(raw);
          // Index by normalised label for fast image lookup
          labelToLayer[normalise(raw)] = layer;
          if (label) {
            layer.bindTooltip(label, {
              permanent: true, direction: 'center', className: 'polygon-label',
            });
          }
        },
      }).addTo(map);

      map.invalidateSize();
      setTimeout(function() {
        var bounds = shapeLayer.getBounds();
        if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
      }, 150);
    }

    // Step 2 – called from RN with stringified [{label, url}] where url is
    // the full http://localhost:8081/api/blob-proxy?... path.
    // The WebView can reach localhost:8081 via adb reverse (cleartext allowed).
    function loadImages(jsonStr) {
      var images = JSON.parse(jsonStr);
      if (!shapeLayer) return;

      images.forEach(function(img) {
        // Match image filename label against polygon field value.
        // CeresPengWeb: featureLabel.replace(/ /g,'_') === img.label
        var layer = labelToLayer[img.label];
        if (!layer) return;

        var bounds = layer.getBounds();
        if (!bounds.isValid()) return;

        // imageOverlay renders the PNG (with alpha transparency) exactly
        // within the polygon bounding box. Transparent pixels are see-through.
        var overlay = L.imageOverlay(img.url, bounds, { opacity: 1, interactive: false });
        overlay.addTo(map);
        imageLayers.push(overlay);
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
      // Fetch shapefile in RN (reliable adb-reverse network)
      const shapeRes = await fetch(
        `${API_URL}/api/shapefile/${encodeURIComponent(sel.farm)}`
      );
      const geojson = await shapeRes.json();

      // Send GeoJSON to WebView → renders polygons + pans camera
      webviewRef.current?.injectJavaScript(
        `loadGeoJSON(${JSON.stringify(JSON.stringify(geojson))}); true;`
      );

      // Fetch image list in RN
      setStatus('Loading images…');
      const imgRes = await fetch(
        `${API_URL}/api/images/${encodeURIComponent(sel.farm)}` +
        `/${encodeURIComponent(sel.date)}/${encodeURIComponent(sel.product)}`
      );
      const imgList: { label: string; url: string }[] = await imgRes.json();

      if (imgList.length === 0) { setStatus(null); return; }

      // Build full URLs so the WebView can fetch them directly.
      // usesCleartextTraffic=true + adb reverse means localhost:8081 is
      // reachable from the WebView just as it is from RN.
      const imagesWithFullUrl = imgList.map((img) => ({
        label: img.label,
        url: `${API_URL}${img.url}`,
      }));

      // Pass only the small label→URL list (not the image bytes themselves)
      webviewRef.current?.injectJavaScript(
        `loadImages(${JSON.stringify(JSON.stringify(imagesWithFullUrl))}); true;`
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
