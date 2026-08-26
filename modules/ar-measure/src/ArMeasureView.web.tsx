import { forwardRef } from 'react';
import type { ArMeasureViewProps, ArMeasureViewRef } from './ArMeasure.types';

export const isArMeasureAvailable = false;

const ArMeasureView = forwardRef<ArMeasureViewRef, ArMeasureViewProps>(() => null);
ArMeasureView.displayName = 'ArMeasureView';

export default ArMeasureView;
