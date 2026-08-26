import type { ViewProps } from 'react-native';

export type MeasurementStatus =
  | 'initializing'
  | 'installing'
  | 'searching'
  | 'ready'
  | 'firstPoint'
  | 'complete'
  | 'unsupported'
  | 'error';

export type MeasurementState = {
  status: MeasurementStatus;
  message: string;
  canPlace: boolean;
  pointCount: number;
  distanceMeters?: number;
};

export type ArMeasureViewRef = {
  placePoint(): Promise<void>;
  reset(): Promise<void>;
};

export type ArMeasureViewProps = ViewProps & {
  onMeasurementStateChange?: (event: { nativeEvent: MeasurementState }) => void;
};
