import { registerWebModule, NativeModule } from 'expo';

// ArMeasureModule is not available on the web platform.
class ArMeasureModule extends NativeModule<{}> {}

export default registerWebModule(ArMeasureModule, 'ArMeasureModule');
