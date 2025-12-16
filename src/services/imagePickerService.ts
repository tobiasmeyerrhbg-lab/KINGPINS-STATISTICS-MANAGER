import { Alert, ActionSheetIOS, Platform } from 'react-native';
import * as ImagePicker from 'react-native-image-picker';

export type PickImageKind = 'photo' | 'logo';

const pickerOptions: ImagePicker.ImageLibraryOptions & ImagePicker.CameraOptions = {
  mediaType: 'photo',
  maxWidth: 512,
  maxHeight: 512,
  quality: 0.8,
  includeBase64: false,
  selectionLimit: 1,
};

async function launchCamera(): Promise<string | undefined> {
  return new Promise(resolve => {
    ImagePicker.launchCamera(pickerOptions, response => {
      if (response?.assets && response.assets[0]?.uri) {
        resolve(response.assets[0].uri);
      } else {
        resolve(undefined);
      }
    });
  });
}

async function launchLibrary(): Promise<string | undefined> {
  return new Promise(resolve => {
    ImagePicker.launchImageLibrary(pickerOptions, response => {
      if (response?.assets && response.assets[0]?.uri) {
        resolve(response.assets[0].uri);
      } else {
        resolve(undefined);
      }
    });
  });
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
