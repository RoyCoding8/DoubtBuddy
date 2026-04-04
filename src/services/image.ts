import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

const LIGHT_REENCODE_THRESHOLD_BYTES = 2 * 1024 * 1024;
const HEAVY_REENCODE_THRESHOLD_BYTES = 7 * 1024 * 1024;

export interface PreparedImage {
  uri: string;
  mimeType: string;
  bytes: number;
  transformed: boolean;
}

const getFileSize = (uri: string): number => {
  try {
    const file = new File(uri);
    return file.info().size ?? file.size ?? 0;
  } catch {
    return 0;
  }
};

const lightReencode = async (uri: string): Promise<PreparedImage> => {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: 2048 } }],
    {
      compress: 0.88,
      format: SaveFormat.JPEG,
      base64: false,
    },
  );

  return {
    uri: result.uri,
    mimeType: 'image/jpeg',
    bytes: getFileSize(result.uri),
    transformed: true,
  };
};

const heavyReencode = async (uri: string): Promise<PreparedImage> => {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: 1600 } }],
    {
      compress: 0.78,
      format: SaveFormat.JPEG,
      base64: false,
    },
  );

  return {
    uri: result.uri,
    mimeType: 'image/jpeg',
    bytes: getFileSize(result.uri),
    transformed: true,
  };
};

export const prepareImageForGemini = async (args: {
  uri: string;
  mimeType?: string | null;
}): Promise<PreparedImage> => {
  const size = getFileSize(args.uri);
  const mimeType = args.mimeType || 'image/jpeg';

  if (size <= 0 || size <= LIGHT_REENCODE_THRESHOLD_BYTES) {
    return {
      uri: args.uri,
      mimeType,
      bytes: size,
      transformed: false,
    };
  }

  if (size <= HEAVY_REENCODE_THRESHOLD_BYTES) {
    return lightReencode(args.uri);
  }

  return heavyReencode(args.uri);
};
