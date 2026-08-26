// Re-export the native module. On web, it will be resolved to ArMeasureModule.web.ts
// and on native platforms to ArMeasureModule.ts
export { default } from './src/ArMeasureModule';
export { default as ArMeasureView, isArMeasureAvailable } from './src/ArMeasureView';
export * from './src/ArMeasure.types';
