import { requireNativeView } from 'expo';
import { ComponentType, forwardRef, RefAttributes } from 'react';
import type { ArMeasureViewProps, ArMeasureViewRef } from './ArMeasure.types';

let NativeView: ReturnType<typeof requireNativeView<ArMeasureViewProps>> | null = null;

try {
  NativeView = requireNativeView<ArMeasureViewProps>('ArMeasure');
} catch {
  // Expo Go does not contain this local native module. The app renders a guided fallback.
}

export const isArMeasureAvailable = NativeView !== null;

const ArMeasureView = forwardRef<ArMeasureViewRef, ArMeasureViewProps>((props, ref) => {
  if (!NativeView) return null;
  const ViewWithRef = NativeView as ComponentType<ArMeasureViewProps & RefAttributes<ArMeasureViewRef>>;
  return <ViewWithRef ref={ref} {...props} />;
});

ArMeasureView.displayName = 'ArMeasureView';

export default ArMeasureView;
