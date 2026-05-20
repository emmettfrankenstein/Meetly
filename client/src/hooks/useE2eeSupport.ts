import { useMemo } from "react";
import { supportsEncodedInsertableStreams } from "../utils/e2eeTransform";

export function useE2eeSupport() {
  return useMemo(() => {
    const isSecureContextAvailable = window.isSecureContext;
    const hasWebCrypto = Boolean(window.crypto?.subtle);
    const hasInsertableStreams = supportsEncodedInsertableStreams();

    return {
      isSupported:
        isSecureContextAvailable && hasWebCrypto && hasInsertableStreams,
      isSecureContextAvailable,
      hasWebCrypto,
      hasInsertableStreams,
    };
  }, []);
}
