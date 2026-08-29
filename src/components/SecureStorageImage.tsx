import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleProp,
  View,
  type ImageStyle,
} from 'react-native';

import { storageService } from '../services/storageService';

type Props = {
  reference?: string | null;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
};

export function SecureStorageImage({
  reference,
  style,
  resizeMode = 'cover',
}: Props) {
  const [url, setUrl] = useState<string | null>(
    reference &&
      !storageService.isPrivateReference(reference)
      ? reference
      : null,
  );

  const [loading, setLoading] = useState(
    Boolean(
      reference &&
        storageService.isPrivateReference(reference),
    ),
  );

  useEffect(() => {
    let active = true;

    if (!reference) {
      setUrl(null);
      setLoading(false);
      return;
    }

    if (!storageService.isPrivateReference(reference)) {
      setUrl(reference);
      setLoading(false);
      return;
    }

    setLoading(true);

    storageService
      .getDisplayUrl(reference)
      .then((signedUrl) => {
        if (!active) {
          return;
        }

        setUrl(signedUrl);
      })
      .catch(() => {
        if (active) {
          setUrl(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [reference]);

  if (loading) {
    return (
      <View style={[style, styles.center]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!url) {
    return <View style={style} />;
  }

  return (
    <Image
      source={{ uri: url }}
      style={style}
      resizeMode={resizeMode}
    />
  );
}

const styles = {
  center: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
};