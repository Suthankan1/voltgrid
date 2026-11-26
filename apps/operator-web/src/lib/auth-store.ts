import { randomBytes } from "node:crypto";

export function createAuthStore<T extends { expiresAt: number }>(capacity: number) {
  const records = new Map<string, T>();

  function removeExpired(now: number) {
    for (const [id, record] of records) {
      if (record.expiresAt <= now) records.delete(id);
    }
  }

  return {
    create(record: T) {
      if (records.size >= capacity) removeExpired(Date.now());
      if (records.size >= capacity) throw new Error("Authentication store is full");
      const id = randomBytes(32).toString("base64url");
      records.set(id, record);
      return id;
    },
    get(id: string) {
      const record = records.get(id);
      if (record && record.expiresAt > Date.now()) return record;
      records.delete(id);
    },
    delete(id: string) {
      records.delete(id);
    },
  };
}
