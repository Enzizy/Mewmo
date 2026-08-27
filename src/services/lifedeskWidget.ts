import LifeDeskWidget, { LifeDeskWidgetSnapshot, isLifeDeskWidgetAvailable } from '../../modules/lifedesk-widget';

export { isLifeDeskWidgetAvailable };

export async function syncLifeDeskWidget(snapshot: LifeDeskWidgetSnapshot) {
  if (!LifeDeskWidget) return;
  await LifeDeskWidget.sync(snapshot);
}
