import { Geist_300Light, Geist_400Regular, Geist_500Medium, Geist_600SemiBold } from '@expo-google-fonts/geist';
import { GeistMono_400Regular, GeistMono_500Medium } from '@expo-google-fonts/geist-mono';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { color } from '@/design/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: color.canvas, card: color.canvas, text: color.ink, border: color.hairline },
};

export default function RootLayout() {
  const [loaded] = useFonts({
    Geist_300Light,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return <View style={{ flex: 1, backgroundColor: color.canvas }} />;

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.canvas } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="emergency"
          options={{ presentation: 'fullScreenModal', animation: 'fade', gestureEnabled: false, contentStyle: { backgroundColor: color.void } }}
        />
        <Stack.Screen name="practice" options={{ presentation: 'fullScreenModal', animation: 'fade', contentStyle: { backgroundColor: color.void } }} />
        <Stack.Screen name="protocol/[id]" options={{ animation: 'slide_from_right' }} />
      </Stack>
    </ThemeProvider>
  );
}
