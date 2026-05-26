/**
 * OsmMap — OpenStreetMap карта чрез Leaflet.js в WebView.
 *
 * Не изисква API ключ. Тайловете идват от tile.openstreetmap.org.
 *
 * Props:
 *   center      — { lat, lng } — начален център на картата
 *   zoom        — начален zoom (default 15)
 *   markers     — масив от маркери { lat, lng, label?, color? }
 *   style       — ViewStyle за контейнера
 *   onReady     — извиква се след зареждане на картата
 */
import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { ViewStyle } from 'react-native';

export interface OsmMarker {
  lat:    number;
  lng:    number;
  label?: string;
  color?: string;  // 'red' | 'green' | 'blue' | 'orange' | любой CSS цвят
}

export interface OsmMapRef {
  /** Премества картата към нови координати */
  panTo: (lat: number, lng: number, zoom?: number) => void;
  /** Добавя/обновява маркерите */
  setMarkers: (markers: OsmMarker[]) => void;
}

interface OsmMapProps {
  center:    { lat: number; lng: number };
  zoom?:     number;
  markers?:  OsmMarker[];
  style?:    ViewStyle;
  onReady?:  () => void;
}

function buildHtml(
  center: { lat: number; lng: number },
  zoom: number,
  markers: OsmMarker[],
): string {
  const markersJson = JSON.stringify(markers);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', { zoomControl: true }).setView([${center.lat}, ${center.lng}], ${zoom});

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  var markerLayer = L.layerGroup().addTo(map);

  function makeIcon(color) {
    var c = color || 'red';
    return L.divIcon({
      className: '',
      html: '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:' + c + ';border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>',
      iconSize: [22, 22],
      iconAnchor: [11, 22],
      popupAnchor: [0, -24],
    });
  }

  function renderMarkers(markers) {
    markerLayer.clearLayers();
    markers.forEach(function(m) {
      var mk = L.marker([m.lat, m.lng], { icon: makeIcon(m.color) });
      if (m.label) mk.bindPopup(m.label);
      mk.addTo(markerLayer);
    });
  }

  renderMarkers(${markersJson});

  // Bridge: React Native → WebView
  document.addEventListener('message', handleMsg);
  window.addEventListener('message', handleMsg);
  function handleMsg(e) {
    try {
      var msg = JSON.parse(e.data);
      if (msg.type === 'panTo') {
        map.setView([msg.lat, msg.lng], msg.zoom || map.getZoom());
      } else if (msg.type === 'setMarkers') {
        renderMarkers(msg.markers);
      }
    } catch(err) {}
  }

  // Notify React Native that the map is ready
  setTimeout(function() {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage('ready');
  }, 300);
</script>
</body>
</html>`;
}

const OsmMap = forwardRef<OsmMapRef, OsmMapProps>(function OsmMap(
  { center, zoom = 15, markers = [], style, onReady },
  ref,
) {
  const webViewRef = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    panTo(lat, lng, z) {
      webViewRef.current?.injectJavaScript(
        `handleMsg({data: JSON.stringify({type:'panTo', lat:${lat}, lng:${lng}, zoom:${z ?? zoom}})})`,
      );
    },
    setMarkers(m) {
      webViewRef.current?.injectJavaScript(
        `handleMsg({data: JSON.stringify({type:'setMarkers', markers:${JSON.stringify(m)}})})`,
      );
    },
  }));

  const html = buildHtml(center, zoom, markers);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        onMessage={(e) => {
          if (e.nativeEvent.data === 'ready') onReady?.();
        }}
        scrollEnabled={false}
      />
    </View>
  );
});

export default OsmMap;

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  webview:   { flex: 1, backgroundColor: 'transparent' },
});
