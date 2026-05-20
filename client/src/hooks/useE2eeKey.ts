import { useCallback, useMemo, useState } from "react";
import {
  formatE2eeKeyForSharing,
  generateRawE2eeKey,
  importE2eeKey,
  parseSharedE2eeKey,
} from "../utils/e2eeCrypto";

type E2eeKeyStatus = "not-required" | "missing" | "ready" | "error";

type UseE2eeKeyOptions = {
  isE2eeEnabled: boolean;
  isHost: boolean;
};

export function useE2eeKey({ isE2eeEnabled, isHost }: UseE2eeKeyOptions) {
  const [rawKeyBase64, setRawKeyBase64] = useState<string | null>(null);
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [error, setError] = useState("");

  const status: E2eeKeyStatus = useMemo(() => {
    if (!isE2eeEnabled) return "not-required";
    if (error) return "error";
    if (cryptoKey) return "ready";
    return "missing";
  }, [cryptoKey, error, isE2eeEnabled]);

  const sharedKey = useMemo(() => {
    if (!rawKeyBase64) return "";
    return formatE2eeKeyForSharing(rawKeyBase64);
  }, [rawKeyBase64]);

  const generateKey = useCallback(async () => {
    try {
      setError("");

      const rawKey = await generateRawE2eeKey();
      const importedKey = await importE2eeKey(rawKey);

      setRawKeyBase64(rawKey);
      setCryptoKey(importedKey);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to generate E2EE key",
      );
    }
  }, []);

  const importSharedKey = useCallback(async (value: string) => {
    try {
      setError("");

      const rawKey = parseSharedE2eeKey(value);
      const importedKey = await importE2eeKey(rawKey);

      setRawKeyBase64(rawKey);
      setCryptoKey(importedKey);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to import E2EE key",
      );
    }
  }, []);

  const clearKey = useCallback(() => {
    setRawKeyBase64(null);
    setCryptoKey(null);
    setError("");
  }, []);

  const shouldBlockMediaJoin = isE2eeEnabled && !cryptoKey;

  return {
    status,
    error,
    cryptoKey,
    sharedKey,
    isHost,
    generateKey,
    importSharedKey,
    clearKey,
    shouldBlockMediaJoin,
  };
}
