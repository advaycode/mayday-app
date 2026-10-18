// App entry. On the web, Skia's CanvasKit (a WebAssembly build of the Skia
// graphics engine) must finish loading before any screen imports Skia, so
// we load it first and only then start the router. Phones skip this.
import { Platform } from 'react-native';

if (Platform.OS === 'web') {
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web');
  // canvaskit.wasm is copied into public/ and served from the site root.
  LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(() => require('expo-router/entry'));
} else {
  require('expo-router/entry');
}
