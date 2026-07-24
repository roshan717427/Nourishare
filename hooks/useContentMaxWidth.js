import { useWindowDimensions } from 'react-native';

/** Cap readable content width on iPad / large phones. */
export function useContentMaxWidth(max = 720) {
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, max);
  const horizontalPadding = Math.max(0, (width - contentWidth) / 2);
  return { width, contentWidth, horizontalPadding, isWide: width >= 768 };
}
