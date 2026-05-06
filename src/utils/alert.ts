import { Alert, Platform } from 'react-native';

type AlertButton = {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

/**
 * 웹에서는 Alert.alert가 동작하지 않으므로 window.alert/confirm 사용
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
): void {
  if (Platform.OS === 'web') {
    const messageStr = [title, message].filter(Boolean).join('\n');
    if (buttons && buttons.length > 0) {
      if (buttons.length === 1) {
        window.alert(messageStr);
        buttons[0].onPress?.();
      } else {
        const confirmBtn = buttons.find((b) => b.style !== 'cancel');
        const cancelBtn = buttons.find((b) => b.style === 'cancel');
        const result = window.confirm(messageStr);
        if (result && confirmBtn?.onPress) {
          confirmBtn.onPress();
        } else if (!result && cancelBtn?.onPress) {
          cancelBtn.onPress();
        }
      }
    } else {
      window.alert(messageStr);
    }
  } else {
    Alert.alert(title, message, buttons);
  }
}
