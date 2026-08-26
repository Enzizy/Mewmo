import { NativeModule, requireOptionalNativeModule } from 'expo';

declare class ArMeasureModule extends NativeModule<Record<string, never>> {}

export default requireOptionalNativeModule<ArMeasureModule>('ArMeasure');
