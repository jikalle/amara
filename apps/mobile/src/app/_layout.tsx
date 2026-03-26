import '../polyfills/crypto'
import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider } from '@privy-io/expo'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { View, Text } from 'react-native'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

const isExpoGo = Constants.appOwnership === 'expo' || Constants.executionEnvironment === 'storeClient'

export default function RootLayout() {
  useEffect(() => {
    if (isExpoGo) return
    // Configure notification handler + request permissions in dev builds
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge:  true,
      }),
    })
    Notifications.requestPermissionsAsync()
  }, [])

  if (isExpoGo) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <View style={{ flex: 1, backgroundColor: '#1A1208', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ color: '#F0B429', fontSize: 18, fontWeight: '800', marginBottom: 12, textAlign: 'center' }}>
              Dev Build Required
            </Text>
            <Text style={{ color: '#C8AA7A', fontSize: 13, lineHeight: 20, textAlign: 'center' }}>
              This app uses native modules (Privy + Notifications) that are not available in Expo Go.
              Build a development client to run the mobile app.
            </Text>
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    )
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PrivyProvider
          appId={process.env.EXPO_PUBLIC_PRIVY_APP_ID ?? ''}
          clientId={process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID ?? ''}
        >
          <QueryClientProvider client={queryClient}>
            <StatusBar style="light" backgroundColor="#1A1208" />
            <Stack
              screenOptions={{
                headerShown:     false,
                contentStyle:    { backgroundColor: '#1A1208' },
                animation:       'slide_from_right',
              }}
            >
              <Stack.Screen name="index"   options={{ animation: 'fade' }} />
              <Stack.Screen name="(wallet)" options={{ headerShown: false }} />
              <Stack.Screen name="onboard" options={{ animation: 'slide_from_bottom' }} />
            </Stack>
          </QueryClientProvider>
        </PrivyProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
