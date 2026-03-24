import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PrivyProvider } from '@privy-io/expo'
import * as Notifications from 'expo-notifications'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
})

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
})

export default function RootLayout() {
  useEffect(() => {
    // Request notification permissions on mount
    Notifications.requestPermissionsAsync()
  }, [])

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
