import React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

export default function IndexRedirect() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#1a2d4a" />
      </View>
    );
  }

  if (Platform.OS === 'web') {
    if (user) return <Redirect href="/(tabs)" />;
    return <Redirect href="/home" />;
  }

  if (user) return <Redirect href="/(tabs)" />;
  return <Redirect href="/(auth)/login" />;
}
