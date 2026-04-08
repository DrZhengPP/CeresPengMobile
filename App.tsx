import { useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFonts } from 'expo-font';

const Geist_600SemiBold = require('@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf');
import CeresLogo from './components/CeresLogo';
import PartnerDropdown, { Selection } from './components/PartnerDropdown';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

const MAP_HTML = `
<!DOCTYPE html>
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
    #loading {
      display: none; position: absolute; top: 50%; left: 50%;
      transform: translate(-50%,-50%); z-index: 9999;
      background: rgba(0,0,0,0.6); color: #fff;
      padding: 12px 20px; border-radius: 8px; font: 14px sans-serif;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="loading">Loading layers…</div>
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

    function showLoading(v) {
      document.getElementById('loading').style.display = v ? 'block' : 'none';
    }

    function clearLayers() {
      if (shapeLayer) { map.removeLayer(shapeLayer); shapeLayer = null; }
      imageLayers.forEach(function(l) { map.removeLayer(l); });
      imageLayers = [];
    }

    // Called from React Native with JSON string payload
    function loadSelection(json) {
      var sel = JSON.parse(json);
      clearLayers();
      showLoading(true);

      var apiBase = sel.apiUrl;

      // 1. Load shapefile → GeoJSON polygon layer
      fetch(apiBase + '/api/shapefile/' + encodeURIComponent(sel.farm))
        .then(function(r) { return r.json(); })
        .then(function(geojson) {
          var polygonId = geojson.polygon_id;

          shapeLayer = L.geoJSON(geojson, {
            style: { color: '#ff4444', weight: 2, fillOpacity: 0 },
            onEachFeature: function(feature, layer) {
              var label = polygonId && feature.properties
                ? (feature.properties[polygonId] || '')
                : '';
              if (label) {
                layer.bindTooltip(String(label), {
                  permanent: true, direction: 'center',
                  className: 'polygon-label',
                });
              }
            },
          }).addTo(map);

          // Fit map to shapefile bounds
          var bounds = shapeLayer.getBounds();
          if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20] });

          // 2. Load product images and overlay each within its polygon bounds
          return fetch(
            apiBase + '/api/images/' +
            encodeURIComponent(sel.farm) + '/' +
            encodeURIComponent(sel.date) + '/' +
            encodeURIComponent(sel.product)
          ).then(function(r) { return r.json(); })
           .then(function(images) {
              images.forEach(function(img) {
                // Match image label to polygon feature by polygon_id property
                shapeLayer.eachLayer(function(layer) {
                  var featureLabel = polygonId && layer.feature && layer.feature.properties
                    ? String(layer.feature.properties[polygonId] || '')
                    : '';
                  if (featureLabel !== img.label) return;

                  var bounds = layer.getBounds();
                  if (!bounds.isValid()) return;

                  var overlay = L.imageOverlay(
                    apiBase + img.url,
                    bounds,
                    { opacity: 1, interactive: false }
                  ).addTo(map);
                  imageLayers.push(overlay);
                });
              });
              showLoading(false);
            });
        })
        .catch(function(e) {
          showLoading(false);
          console.error('loadSelection error:', e);
        });
    }

    function clearSelection() {
      clearLayers();
      map.setView([20, 0], 3);
    }
  </script>
</body>
</html>
`;

export default function App() {
  const [fontsLoaded] = useFonts({ Geist_600SemiBold });
  const webviewRef = useRef<WebView>(null);
  const [layersLoading, setLayersLoading] = useState(false);

  function handleSelect(sel: Selection) {
    setLayersLoading(true);
    const payload = JSON.stringify({ ...sel, apiUrl: API_URL });
    webviewRef.current?.injectJavaScript(
      `loadSelection(${JSON.stringify(payload)}); true;`
    );
    // Loading indicator in RN side — WebView will hide its own loader
    setTimeout(() => setLayersLoading(false), 8000);
  }

  function handleClear() {
    webviewRef.current?.injectJavaScript(`clearSelection(); true;`);
    setLayersLoading(false);
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
      {layersLoading && (
        <View style={styles.mapLoading}>
          <ActivityIndicator size="small" color="#ffffff" />
          <Text style={styles.mapLoadingText}>Loading layers…</Text>
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
  mapLoading: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  mapLoadingText: { color: '#ffffff', fontSize: 13 },
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
