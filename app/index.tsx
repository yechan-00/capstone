import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function IndexRedirect() {
  const { loading, isRegistered } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#1a2d4a" />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    if (isRegistered) return <Redirect href="/(tabs)" />;
    return <Redirect href="/home" />;
  }

  if (isRegistered) return <Redirect href="/(tabs)" />;
  return <Redirect href="/(auth)/login" />;
}
