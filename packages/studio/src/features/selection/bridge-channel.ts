// Bridge postMessage communication channel for Studio (SPEC-04 M-BR, R-BR-30, R-BR-31, V-110..111).
export {
  BridgeChannel,
  type BridgeFreeFrameListener,
  type BridgeTextEditListener,
  type SelectionSyncCallback,
} from './bridge-channel-base.ts';
export {
  BridgeChannelRegistry,
  bridgeChannels,
  StudioBridgeChannel,
  studioBridgeChannel,
  useBridgeChannel,
} from './bridge-channel-router.ts';
