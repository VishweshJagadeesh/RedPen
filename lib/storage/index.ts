/**
 * File storage behind a small interface.
 * - "samples/..." keys point at the bundled sample images in /public/samples (read-only).
 * - Local adapter (development): files under ./.data/uploads, served by /api/files/[...key].
 * - Vercel Blob adapter (production): keys are the public blob URLs.
 */
import fs from "node:fs/promises";
import path from "node:path";

export interface StoredFile {
  data: Buffer;
  contentType: string;
}

export interface StorageAdapter {
  readonly name: string;
  put(key: string, data: Buffer, contentType: string): Promise<string>;
  get(key: string): Promise<StoredFile | null>;
  url(key: string): string;
}

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

export function contentTypeFor(key: string): string {
  return CONTENT_TYPES[path.extname(key).toLowerCase()] ?? "application/octet-stream";
}

export function isSampleKey(key: string) {
  return key.startsWith("samples/");
}

function publicBaseUrl(): string | null {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return null;
}

async function readSample(key: string): Promise<StoredFile | null> {
  const file = path.join(process.cwd(), "public", key);
  try {
    return { data: await fs.readFile(file), contentType: contentTypeFor(key) };
  } catch {
    const base = publicBaseUrl();
    if (!base) return null;
    const res = await fetch(`${base}/${key}`);
    if (!res.ok) return null;
    return { data: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? contentTypeFor(key) };
  }
}

class LocalAdapter implements StorageAdapter {
  readonly name = "local";
  private root = process.env.VERCEL ? "/tmp/redpen-uploads" : path.join(process.cwd(), ".data", "uploads");

  async put(key: string, data: Buffer): Promise<string> {
    const file = path.join(this.root, key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data);
    return key;
  }

  async get(key: string): Promise<StoredFile | null> {
    if (isSampleKey(key)) return readSample(key);
    const file = path.join(this.root, key);
    if (!file.startsWith(this.root)) return null;
    try {
      return { data: await fs.readFile(file), contentType: contentTypeFor(key) };
    } catch {
      return null;
    }
  }

  url(key: string): string {
    if (isSampleKey(key)) return `/${key}`;
    return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
  }
}

class BlobAdapter implements StorageAdapter {
  readonly name = "blob";

  async put(key: string, data: Buffer, contentType: string): Promise<string> {
    const { put } = await import("@vercel/blob");
    const res = await put(key, data, { access: "public", contentType, addRandomSuffix: true });
    return res.url;
  }

  async get(key: string): Promise<StoredFile | null> {
    if (isSampleKey(key)) return readSample(key);
    const res = await fetch(key);
    if (!res.ok) return null;
    return { data: Buffer.from(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? contentTypeFor(key) };
  }

  url(key: string): string {
    if (isSampleKey(key)) return `/${key}`;
    return key;
  }
}

let adapter: StorageAdapter | null = null;

export function storage(): StorageAdapter {
  if (adapter) return adapter;
  const driver = process.env.STORAGE_DRIVER ?? (process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local");
  adapter = driver === "blob" ? new BlobAdapter() : new LocalAdapter();
  return adapter;
}

/** Public URL for a stored key, safe to call from server components. */
export function fileUrl(key: string): string {
  if (isSampleKey(key)) return `/${key}`;
  if (key.startsWith("http")) return key;
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}
