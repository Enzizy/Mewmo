import { NativeModule, requireOptionalNativeModule } from 'expo';
import { LifeDeskWidgetSnapshot } from './LifeDeskWidget.types';

declare class LifeDeskWidgetModule extends NativeModule<Record<string, never>> {
  sync(snapshot: LifeDeskWidgetSnapshot): Promise<void>;
}

const nativeModule = requireOptionalNativeModule<LifeDeskWidgetModule>('LifeDeskWidget');

export const isLifeDeskWidgetAvailable = Boolean(nativeModule);
export default nativeModule;
