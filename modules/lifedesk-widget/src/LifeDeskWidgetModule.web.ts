import { registerWebModule, NativeModule } from 'expo';
import { LifeDeskWidgetSnapshot } from './LifeDeskWidget.types';

class LifeDeskWidgetModule extends NativeModule<Record<string, never>> {
  async sync(_snapshot: LifeDeskWidgetSnapshot) {}
}

export const isLifeDeskWidgetAvailable = false;
export default registerWebModule(LifeDeskWidgetModule, 'LifeDeskWidget');
