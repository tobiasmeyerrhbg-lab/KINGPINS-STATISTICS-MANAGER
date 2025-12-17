import { Alert, ActionSheetIOS, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export type PickImageKind = 'photo' | 'logo';

async function launchCamera(): Promise<string | undefined> {
  try {
    // Request camera permission
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos.');
      return undefined;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }
    return undefined;
  } catch (error) {
    console.error('Camera error:', error);
    Alert.alert('Error', 'Failed to launch camera. Please try again.');
    return undefined;
  }
}

async function launchLibrary(): Promise<string | undefined> {
  try {
    // Request media library permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Media library permission is required to choose photos.');
      return undefined;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }
    return undefined;
  } catch (error) {
    console.error('Library error:', error);
    Alert.alert('Error', 'Failed to open media library. Please try again.');
    return undefined;
  }
}

export async function pickImageWithPrompt(kind: PickImageKind): Promise<string | undefined> {
  const title = kind === 'logo' ? 'Pick Logo' : 'Pick Photo';
  if (Platform.OS === 'ios') {
    return new Promise(resolve => {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title,
          options: ['Take Photo', 'Choose from Library', 'Cancel'],
          cancelButtonIndex: 2,
        },
        async (buttonIndex) => {
          try {
            if (buttonIndex === 0) {
              const uri = await launchCamera();
              resolve(uri);
            } else if (buttonIndex === 1) {
              const uri = await launchLibrary();
              resolve(uri);
            } else {
              resolve(undefined);
            }
          } catch (e) {
            resolve(undefined);
          }
        }
      );
    });
  }
  // Android & others
  return new Promise(resolve => {
    Alert.alert(
      title,
      undefined,
      [
        { text: 'Take Photo', onPress: async () => resolve(await launchCamera()) },
        { text: 'Choose from Library', onPress: async () => resolve(await launchLibrary()) },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(undefined) },
      ],
      { cancelable: true }
    );
  });
}
