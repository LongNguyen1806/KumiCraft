// Public entry point of @kumicraft/bridge (QC-03).
export { BRIDGE_CLIENT_CODE } from './client/bridge-client.generated.ts';
export {
  BRIDGE_CLIENT_URL,
  type BridgePluginOptions,
  createKumiCraftBridgePlugin,
  type HtmlTagDescriptor,
} from './integrations/vite.ts';
export {
  shouldTransform,
  transformJsx,
  type TransformJsxOptions,
  type TransformJsxResult,
} from './transform/transform-jsx.ts';
