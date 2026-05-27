/**
 * OsmMap — OpenStreetMap map via Leaflet.js in a WebView.
 *
 * No API key required. Tiles are served from tile.openstreetmap.org.
 *
 * Leaflet JS + CSS are embedded directly in HTML (leaflet-bundle.ts) —
 * no CDN requests are made on startup; the map works even offline
 * (except for the map tiles themselves, which require an internet connection).
 */
import React, { useRef, useImperativeHandle, forwardRef, useMemo, useEffect } from 'react';
import { StyleSheet, View, Pressable, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewErrorEvent, WebViewHttpErrorEvent } from 'react-native-webview';
import type { ViewStyle } from 'react-native';
import { LEAFLET_JS, LEAFLET_CSS } from './leaflet-bundle';

export interface OsmMarker {
  lat:    number;
  lng:    number;
  label?: string;
  color?: string;
}

export interface OsmMapRef {
  panTo:      (lat: number, lng: number, zoom?: number) => void;
  setMarkers: (markers: OsmMarker[]) => void;
}

interface OsmMapProps {
  center:         { lat: number; lng: number };
  zoom?:          number;
  markers?:       OsmMarker[];
  style?:         ViewStyle;
  onReady?:       () => void;
  /**
   * Pass the user's GPS position to show a "locate me" button (bottom-right).
   * Button is visible whenever this prop is set (even null = GPS loading);
   * it is disabled and greyed out until a real position arrives.
   */
  locatePosition?: { lat: number; lng: number } | null;
  /**
   * Fires on every Leaflet "moveend" event (drag end / pan end / zoom end).
   * Use this in map-picker screens to reverse-geocode the new centre.
   */
  onCenterChange?: (lat: number, lng: number) => void;
}

// HTML is built once with the initial centre — afterwards updated via JS.
// Leaflet JS and CSS are embedded directly — no CDN/network needed on load.
function buildHtml(center: { lat: number; lng: number }, zoom: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
  <style>${LEAFLET_CSS}</style>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; overflow:hidden; }
  </style>
</head>
<body>
<div id="map"></div>
<script>
${LEAFLET_JS}
</script>
<script>
  var map = L.map('map', { zoomControl: true })
              .setView([${center.lat}, ${center.lng}], ${zoom});

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  var markerLayer = L.layerGroup().addTo(map);

  function makeIcon(color) {
    return L.divIcon({
      className: '',
      html: '<div style="width:20px;height:20px;border-radius:50% 50% 50% 0;'
          + 'background:' + (color || '#e74c3c') + ';border:2px solid #fff;'
          + 'transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>',
      iconSize:    [20, 20],
      iconAnchor:  [10, 20],
      popupAnchor: [0, -22],
    });
  }

  function renderMarkers(markers) {
    markerLayer.clearLayers();
    (markers || []).forEach(function(m) {
      var mk = L.marker([m.lat, m.lng], { icon: makeIcon(m.color) });
      if (m.label) mk.bindPopup(m.label);
      mk.addTo(markerLayer);
    });
  }

  // Bridge: injectJavaScript → window.dispatchCmd
  window.dispatchCmd = function(msg) {
    try {
      var d = typeof msg === 'string' ? JSON.parse(msg) : msg;
      if (d.type === 'panTo')      map.setView([d.lat, d.lng], d.zoom || map.getZoom());
      if (d.type === 'setMarkers') renderMarkers(d.markers);
    } catch(e) {}
  };

  // Notify React Native that map is ready
  setTimeout(function() {
    try { window.ReactNativeWebView.postMessage('ready'); } catch(e) {}
  }, 300);

  // Emit map centre on every moveend — used by MapPickerScreen for reverse geocoding.
  // All OsmMap instances emit this; the React Native side calls onCenterChange only
  // when the prop is provided, so there is no overhead for screens that don't need it.
  map.on('moveend', function() {
    var c = map.getCenter();
    try {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({ type: 'centerChanged', lat: c.lat, lng: c.lng })
      );
    } catch(e) {}
  });
</script>
</body>
</html>`;
}

const OsmMap = forwardRef<OsmMapRef, OsmMapProps>(function OsmMap(
  { center, zoom = 14, markers = [], style, onReady, locatePosition, onCenterChange },
  ref,
) {
  const webViewRef  = useRef<WebView>(null);
  const initialZoom = useRef(zoom).current;

  // HTML is built once — WebView does not restart when props change
  const html = useMemo(
    () => buildHtml(center, initialZoom),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Update markers on change (without reloading the WebView)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { inject({ type: 'setMarkers', markers }); }, [JSON.stringify(markers)]);

  // Update the centre when it changes
  useEffect(() => {
    inject({ type: 'panTo', lat: center.lat, lng: center.lng, zoom });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng]);

  function inject(cmd: object) {
    const js = `window.dispatchCmd(${JSON.stringify(cmd)}); true;`;
    webViewRef.current?.injectJavaScript(js);
  }

  useImperativeHandle(ref, () => ({
    panTo(lat, lng, z) { inject({ type: 'panTo', lat, lng, zoom: z ?? zoom }); },
    setMarkers(m)      { inject({ type: 'setMarkers', markers: m }); },
  }));

  const handleError = (e: WebViewErrorEvent) => {
    console.warn('[OsmMap] WebView error:', e.nativeEvent.description);
  };
  const handleHttpError = (e: WebViewHttpErrorEvent) => {
    console.warn('[OsmMap] HTTP error:', e.nativeEvent.statusCode, e.nativeEvent.url);
  };

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
          const raw = e.nativeEvent.data;
          if (raw === 'ready') {
            inject({ type: 'setMarkers', markers });
            onReady?.();
            return;
          }
          // JSON messages from Leaflet (e.g. centerChanged from moveend)
          try {
            const msg = JSON.parse(raw) as { type: string; lat: number; lng: number };
            if (msg.type === 'centerChanged') onCenterChange?.(msg.lat, msg.lng);
          } catch {
            // not a JSON message — ignore
          }
        }}
        onError={handleError}
        onHttpError={handleHttpError}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
      {locatePosition !== undefined && (
        <Pressable
          style={({ pressed }) => [
            styles.locateBtn,
            !locatePosition && styles.locateBtnDisabled,
            pressed && locatePosition && styles.locateBtnPressed,
          ]}
          disabled={!locatePosition}
          onPress={() => {
            if (locatePosition) {
              inject({ type: 'panTo', lat: locatePosition.lat, lng: locatePosition.lng, zoom: 16 });
            }
          }}
        >
          <Text style={[styles.locateBtnText, !locatePosition && styles.locateBtnTextDisabled]}>
            ⊙
          </Text>
        </Pressable>
      )}
    </View>
  );
});

export default OsmMap;

const styles = StyleSheet.create({
  container:     { overflow: 'hidden' },
  webview:       { flex: 1, backgroundColor: 'transparent' },
  locateBtn: {
    position: 'absolute', bottom: 12, right: 12,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  locateBtnDisabled:     { backgroundColor: '#f0f0f0', shadowOpacity: 0.1, elevation: 1 },
  locateBtnPressed:      { backgroundColor: '#e0e0e0' },
  locateBtnText:         { fontSize: 22, color: '#1a1a2e', lineHeight: 26 },
  locateBtnTextDisabled: { color: '#bbb' },
});
