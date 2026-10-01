import { createKeyHolder } from "@maat-apps/core/lock";

// The app lock's AES-GCM key, in memory only (@maat-apps/core/lock). The lock
// sets it; every module that persists user data encrypts with it whenever
// it's set, and waits for it before its first read when the enrolled lock
// encrypts — see maat-core's docs/storage.md.
export const encryptionKey = createKeyHolder();
