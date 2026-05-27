import { unzipSync } from "fflate";

export interface ZipParseRequest {
  bytes: Uint8Array;
}

export interface ZipParseEntry {
  name: string;
  bytes: Uint8Array;
}

export interface ZipParseResponse {
  ok: boolean;
  entries?: ZipParseEntry[];
  error?: string;
}

self.onmessage = (event: MessageEvent<ZipParseRequest>) => {
  try {
    const files = unzipSync(event.data.bytes);
    const entries: ZipParseEntry[] = Object.entries(files)
      .filter(([name]) => !name.endsWith("/"))
      .map(([name, bytes]) => ({ name, bytes }));
    self.postMessage({ ok: true, entries } satisfies ZipParseResponse);
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) } satisfies ZipParseResponse);
  }
};
