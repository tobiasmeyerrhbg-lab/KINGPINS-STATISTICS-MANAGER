import React, { useEffect, useState } from 'react';
import { Image, ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';

interface ClubLogoProps {
  logoUri?: string | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
  testID?: string;
}

// Fallback dummy image asset
const DUMMY_LOGO: ImageSourcePropType = require('../../assets/images/dummy/default_profile.png');

export default function ClubLogo({ logoUri, style, resizeMode = 'cover', testID }: ClubLogoProps) {
  const [source, setSource] = useState<ImageSourcePropType>(
    logoUri && logoUri.trim().length > 0 ? { uri: logoUri } : DUMMY_LOGO
  );

  // Update source when logoUri changes
  useEffect(() => {
    if (logoUri && logoUri.trim().length > 0) {
      setSource({ uri: logoUri });
    } else {
      setSource(DUMMY_LOGO);
    }
  }, [logoUri]);

  return (
    <Image
      source={source}
      onError={() => setSource(DUMMY_LOGO)}
      style={style}
      resizeMode={resizeMode}
      testID={testID}
    />
  );
}
