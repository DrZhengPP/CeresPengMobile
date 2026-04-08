import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useFonts } from 'expo-font';

const Geist_600SemiBold = require('@expo-google-fonts/geist/600SemiBold/Geist_600SemiBold.ttf');
import CeresLogo from './components/CeresLogo';
import PartnerDropdown from './components/PartnerDropdown';

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
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', {
      center: [20, 0],
      zoom: 3,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, GeoEye, Earthstar Geographics',
      }
    ).addTo(map);
  </script>
</body>
</html>
`;

export default function App() {
  const [fontsLoaded] = useFonts({ Geist_600SemiBold });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <WebView
        style={styles.map}
        source={{ html: MAP_HTML }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState={false}
        androidLayerType="hardware"
      />
      <View style={styles.menu}>
        <View style={styles.brand}>
          <CeresLogo size={30} />
          <Text style={[styles.title, fontsLoaded && { fontFamily: 'Geist_600SemiBold' }]}>
            Vulcan CeresPeng
          </Text>
        </View>
        <View style={styles.divider} />
        <PartnerDropdown />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 11,
  },
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
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 24,
    backgroundColor: '#e5e7eb',
  },
});
