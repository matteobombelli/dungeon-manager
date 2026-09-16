import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { API_PREFIX } from "../../shared/api";
import { cookieHeader, registerAndLogin, request } from "./helpers";

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const AUDIO_MAX_BYTES = 30 * 1024 * 1024;

// R2 and D1 state persists across tests within a file, so every registration needs its own email.
let seq = 0;
function uniqueEmail(): string {
  return `asset${++seq}@example.com`;
}

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function pngBytes(): Uint8Array {
  const binary = atob(PNG_BASE64);
  return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
}

// The route never parses the audio, so an ID3 header and a few bytes of padding are enough.
function mp3Bytes(): Uint8Array {
  return new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
}

// A RIFF/WAVE header with no sample data: enough for the route, which never parses the audio.
function wavBytes(): Uint8Array {
  return new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]);
}

interface AssetBody {
  asset: { id: string; contentType: string; size: number; url: string };
}

function upload(cookie: string, body: BodyInit, contentType = "image/png"): Promise<Response> {
  return request("/assets", {
    method: "POST",
    headers: { "Content-Type": contentType, Cookie: cookie },
    body,
  });
}

async function uploadPng(cookie: string): Promise<AssetBody["asset"]> {
  const bytes = pngBytes();
  const res = await upload(cookie, bytes);
  if (res.status !== 201) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as AssetBody).asset;
}

async function uploadWav(cookie: string): Promise<AssetBody["asset"]> {
  const res = await upload(cookie, wavBytes(), "audio/wav");
  if (res.status !== 201) throw new Error(`upload failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as AssetBody).asset;
}

function r2Key(assetId: string): Promise<string | null> {
  return env.DB.prepare("SELECT r2_key FROM assets WHERE id = ?")
    .bind(assetId)
    .first<{ r2_key: string }>()
    .then((row) => row?.r2_key ?? null);
}

describe("POST /assets", () => {
  it("stores the image and returns the asset", async () => {
    const { cookie, user } = await registerAndLogin(uniqueEmail());
    const bytes = pngBytes();
    const res = await upload(cookie, bytes);
    expect(res.status).toBe(201);

    const { asset } = (await res.json()) as AssetBody;
    expect(Object.keys(asset).sort()).toEqual(["contentType", "id", "size", "url"]);
    expect(asset.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(asset.contentType).toBe("image/png");
    expect(asset.size).toBe(bytes.byteLength);
    expect(asset.url).toBe(`${API_PREFIX}/assets/${asset.id}`);

    const key = await r2Key(asset.id);
    expect(key).toBe(`users/${user.id}/${asset.id}.png`);
    const obj = await env.BUCKET.get(key!);
    expect(obj?.httpMetadata?.contentType).toBe("image/png");
  });

  it("accepts a content type with parameters", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const res = await upload(cookie, pngBytes(), "image/jpeg; charset=binary");
    expect(res.status).toBe(201);
    const { asset } = (await res.json()) as AssetBody;
    expect(asset.contentType).toBe("image/jpeg");
    expect(await r2Key(asset.id)).toMatch(/\.jpg$/);
  });

  it("ignores X-File-Name", async () => {
    const { cookie, user } = await registerAndLogin(uniqueEmail());
    const res = await request("/assets", {
      method: "POST",
      headers: { "Content-Type": "image/png", Cookie: cookie, "X-File-Name": "map.png" },
      body: pngBytes(),
    });
    expect(res.status).toBe(201);
    const { asset } = (await res.json()) as AssetBody;
    expect(await r2Key(asset.id)).toBe(`users/${user.id}/${asset.id}.png`);
  });

  it("stores an audio upload under an extension for its type", async () => {
    const { cookie, user } = await registerAndLogin(uniqueEmail());
    const bytes = mp3Bytes();
    const res = await upload(cookie, bytes, "audio/mpeg");
    expect(res.status).toBe(201);

    const { asset } = (await res.json()) as AssetBody;
    expect(asset.contentType).toBe("audio/mpeg");
    expect(asset.size).toBe(bytes.byteLength);

    const key = await r2Key(asset.id);
    expect(key).toBe(`users/${user.id}/${asset.id}.mp3`);
    const obj = await env.BUCKET.get(key!);
    expect(obj?.httpMetadata?.contentType).toBe("audio/mpeg");
  });

  it("rejects an unsupported content type", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const res = await upload(cookie, "hello", "text/plain");
    expect(res.status).toBe(415);
    expect(await res.json()).toEqual({ error: "Unsupported file type" });
  });

  it("rejects a missing content type", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const res = await request("/assets", { method: "POST", headers: { Cookie: cookie }, body: pngBytes() });
    expect(res.status).toBe(415);
  });

  it("rejects an empty body", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const res = await upload(cookie, new Uint8Array(0));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Empty body" });
  });

  it("rejects a body over 10 MB", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const res = await upload(cookie, new Uint8Array(IMAGE_MAX_BYTES + 1));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Payload too large" });
  });

  it("rejects a declared length over 10 MB without reading the body", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const res = await request("/assets", {
      method: "POST",
      headers: { "Content-Type": "image/png", Cookie: cookie, "Content-Length": String(IMAGE_MAX_BYTES + 1) },
      body: pngBytes(),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Payload too large" });
  });

  it("rejects a declared audio length over 30 MB", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const res = await request("/assets", {
      method: "POST",
      headers: {
        "Content-Type": "audio/mpeg",
        Cookie: cookie,
        "Content-Length": String(AUDIO_MAX_BYTES + 1),
      },
      body: mp3Bytes(),
    });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "Payload too large" });
  });

  it("holds audio to the audio cap, not the image one", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const res = await request("/assets", {
      method: "POST",
      headers: {
        "Content-Type": "audio/mpeg",
        Cookie: cookie,
        "Content-Length": String(IMAGE_MAX_BYTES + 1),
      },
      body: mp3Bytes(),
    });
    expect(res.status).toBe(201);
  });

  it("requires a session", async () => {
    const res = await request("/assets", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: pngBytes(),
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Unauthorized" });
  });
});

describe("GET /assets/:id", () => {
  it("serves the stored bytes with caching headers", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const bytes = pngBytes();
    const asset = await uploadPng(cookie);

    const res = await request(`/assets/${asset.id}`, { headers: cookieHeader(cookie) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Content-Length")).toBe(String(bytes.byteLength));
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("ETag")).toBeTruthy();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it("answers HEAD with the GET headers and no body", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const asset = await uploadPng(cookie);

    const get = await request(`/assets/${asset.id}`, { headers: cookieHeader(cookie) });
    await get.arrayBuffer();
    const res = await request(`/assets/${asset.id}`, { method: "HEAD", headers: cookieHeader(cookie) });

    expect(res.status).toBe(200);
    for (const header of ["Content-Type", "Content-Length", "ETag", "Accept-Ranges"]) {
      expect(res.headers.get(header)).toBe(get.headers.get(header));
    }
    expect(await res.text()).toBe("");
  });

  it("serves a closed byte range as 206", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const bytes = pngBytes();
    const asset = await uploadPng(cookie);

    const res = await request(`/assets/${asset.id}`, { headers: { Cookie: cookie, Range: "bytes=0-3" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe(`bytes 0-3/${bytes.byteLength}`);
    expect(res.headers.get("Content-Length")).toBe("4");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes.slice(0, 4));
  });

  it("serves an open-ended byte range as 206", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const bytes = pngBytes();
    const asset = await uploadPng(cookie);

    const res = await request(`/assets/${asset.id}`, { headers: { Cookie: cookie, Range: "bytes=2-" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe(`bytes 2-${bytes.byteLength - 1}/${bytes.byteLength}`);
    expect(res.headers.get("Content-Length")).toBe(String(bytes.byteLength - 2));
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes.slice(2));
  });

  // Safari's <audio> opens with this and only enables seeking if the answer is partial.
  it("serves a range covering the whole object as 206", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const bytes = pngBytes();
    const asset = await uploadPng(cookie);

    const res = await request(`/assets/${asset.id}`, { headers: { Cookie: cookie, Range: "bytes=0-" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe(`bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}`);
    expect(res.headers.get("Content-Length")).toBe(String(bytes.byteLength));
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it("serves a suffix range as 206", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const bytes = pngBytes();
    const asset = await uploadPng(cookie);

    const res = await request(`/assets/${asset.id}`, { headers: { Cookie: cookie, Range: "bytes=-4" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Range")).toBe(
      `bytes ${bytes.byteLength - 4}-${bytes.byteLength - 1}/${bytes.byteLength}`,
    );
    expect(res.headers.get("Content-Length")).toBe("4");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes.slice(-4));
  });

  it("serves a byte range of an audio asset", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const bytes = wavBytes();
    const asset = await uploadWav(cookie);

    const res = await request(`/assets/${asset.id}`, { headers: { Cookie: cookie, Range: "bytes=4-7" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("Content-Type")).toBe("audio/wav");
    expect(res.headers.get("Content-Range")).toBe(`bytes 4-7/${bytes.byteLength}`);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes.slice(4, 8));
  });

  // RFC 9110 §14.1.1: an invalid range spec invalidates the header, and an invalid Range may be ignored.
  it.each(["bytes=abc", "bytes=0-1,3-4", "bytes=5-2"])("serves the whole body for %s", async (range) => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const asset = await uploadPng(cookie);

    const res = await request(`/assets/${asset.id}`, { headers: { Cookie: cookie, Range: range } });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Range")).toBeNull();
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(pngBytes());
  });

  it("returns 416 for a zero-length suffix range", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const size = pngBytes().byteLength;
    const asset = await uploadPng(cookie);

    const res = await request(`/assets/${asset.id}`, { headers: { Cookie: cookie, Range: "bytes=-0" } });
    expect(res.status).toBe(416);
    expect(res.headers.get("Content-Range")).toBe(`bytes */${size}`);
  });

  it("returns 416 for a range starting past the end", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const size = pngBytes().byteLength;
    const asset = await uploadPng(cookie);

    const res = await request(`/assets/${asset.id}`, { headers: { Cookie: cookie, Range: `bytes=${size}-` } });
    expect(res.status).toBe(416);
    expect(res.headers.get("Content-Range")).toBe(`bytes */${size}`);
    expect(await res.text()).toBe("");
  });

  it("returns 304 when the ETag matches", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const asset = await uploadPng(cookie);

    const first = await request(`/assets/${asset.id}`, { headers: cookieHeader(cookie) });
    const etag = first.headers.get("ETag")!;
    await first.arrayBuffer();

    const res = await request(`/assets/${asset.id}`, { headers: { Cookie: cookie, "If-None-Match": etag } });
    expect(res.status).toBe(304);
    expect(res.headers.get("ETag")).toBe(etag);
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=31536000, immutable");
    expect(res.headers.get("Accept-Ranges")).toBe("bytes");
  });

  it("returns 304 for a matching ETag even with a Range", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const asset = await uploadPng(cookie);

    const first = await request(`/assets/${asset.id}`, { headers: cookieHeader(cookie) });
    const etag = first.headers.get("ETag")!;
    await first.arrayBuffer();

    const res = await request(`/assets/${asset.id}`, {
      headers: { Cookie: cookie, "If-None-Match": etag, Range: "bytes=0-3" },
    });
    expect(res.status).toBe(304);
    expect(res.headers.get("Content-Range")).toBeNull();
    expect(await res.text()).toBe("");
  });

  it("serves the body when the ETag does not match", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const asset = await uploadPng(cookie);
    const res = await request(`/assets/${asset.id}`, {
      headers: { Cookie: cookie, "If-None-Match": '"not-the-etag"' },
    });
    expect(res.status).toBe(200);
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(pngBytes());
  });

  it("hides another user's asset", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const asset = await uploadPng(cookie);
    const other = await registerAndLogin(uniqueEmail());

    const res = await request(`/assets/${asset.id}`, { headers: cookieHeader(other.cookie) });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Not found" });
  });

  it("404s for an unknown id", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const res = await request(`/assets/${crypto.randomUUID()}`, { headers: cookieHeader(cookie) });
    expect(res.status).toBe(404);
  });

  it("requires a session", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const asset = await uploadPng(cookie);
    const res = await request(`/assets/${asset.id}`);
    expect(res.status).toBe(401);
  });
});

describe("DELETE /assets/:id", () => {
  it("removes the row and the object", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const asset = await uploadPng(cookie);
    const key = (await r2Key(asset.id))!;

    const res = await request(`/assets/${asset.id}`, { method: "DELETE", headers: cookieHeader(cookie) });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");

    expect(await env.BUCKET.get(key)).toBeNull();
    expect(await r2Key(asset.id)).toBeNull();

    const get = await request(`/assets/${asset.id}`, { headers: cookieHeader(cookie) });
    expect(get.status).toBe(404);
  });

  it("hides another user's asset", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const asset = await uploadPng(cookie);
    const other = await registerAndLogin(uniqueEmail());

    const res = await request(`/assets/${asset.id}`, { method: "DELETE", headers: cookieHeader(other.cookie) });
    expect(res.status).toBe(404);
    expect(await r2Key(asset.id)).not.toBeNull();
  });

  it("requires a session", async () => {
    const { cookie } = await registerAndLogin(uniqueEmail());
    const asset = await uploadPng(cookie);
    const res = await request(`/assets/${asset.id}`, { method: "DELETE" });
    expect(res.status).toBe(401);
  });
});
