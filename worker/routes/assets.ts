import { API_PREFIX, type Asset } from "../../shared/api";
import { newId } from "../../shared/ids";
import { requireUser } from "../auth/session";
import { json, now, readBounded } from "../http";
import { HttpError, type Router } from "../router";

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const AUDIO_MAX_BYTES = 30 * 1024 * 1024;
const CACHE_CONTROL = "private, max-age=31536000, immutable";

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/webm": "weba",
  "audio/flac": "flac",
};

interface AssetRow {
  id: string;
  r2_key: string;
  content_type: string;
  size: number;
}

async function getAssetOwned(db: D1Database, id: string, userId: string): Promise<AssetRow> {
  const row = await db
    .prepare("SELECT id, r2_key, content_type, size FROM assets WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<AssetRow>();
  if (!row) throw new HttpError(404, "Not found");
  return row;
}

// R2 normalises every Range header it accepts to the same shape, so the object it returns cannot say
// whether the client asked for a part or the whole; parsing the header here is the only source of truth.
// RFC 9110 §14.1.1: an unparseable byte-range-set (multi-range, "bytes=abc", a last-pos below the
// first-pos) makes the header invalid, and an invalid Range may be ignored, so "ignore" means 200.
function parseRange(header: string, size: number): { offset: number; length: number } | "ignore" | "unsatisfiable" {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return "ignore";
  const [, first, last] = m;
  if (first === "") {
    if (last === "") return "ignore";
    const suffix = Number(last);
    if (suffix === 0) return "unsatisfiable";
    const offset = Math.max(0, size - suffix);
    return { offset, length: size - offset };
  }
  const offset = Number(first);
  if (offset >= size) return "unsatisfiable";
  if (last === "") return { offset, length: size - offset };
  const end = Number(last);
  if (end < offset) return "ignore";
  return { offset, length: Math.min(end, size - 1) - offset + 1 };
}

function rangeNotSatisfiable(size: number): Response {
  return new Response(null, {
    status: 416,
    headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
  });
}

/** Matches an If-None-Match header against an entity tag, honouring "*" and weak tags. */
function etagMatches(header: string, etag: string): boolean {
  const strip = (s: string) => s.trim().replace(/^W\//, "");
  return header.split(",").some((candidate) => {
    const c = strip(candidate);
    return c === "*" || c === strip(etag);
  });
}

export function registerAssetRoutes(r: Router): void {
  r.post("/assets", async (c) => {
    const user = await requireUser(c);
    const contentType = (c.req.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = EXTENSIONS[contentType];
    if (!ext) throw new HttpError(415, "Unsupported file type");
    const maxBytes = contentType.startsWith("audio/") ? AUDIO_MAX_BYTES : IMAGE_MAX_BYTES;
    const declared = Number(c.req.headers.get("Content-Length"));
    if (declared > maxBytes) throw new HttpError(413, "Payload too large");

    const bytes = await readBounded(c.req.body, maxBytes, declared);
    if (bytes.byteLength === 0) throw new HttpError(400, "Empty body");

    const id = newId();
    const key = `users/${user.id}/${id}.${ext}`;
    await c.env.BUCKET.put(key, bytes, { httpMetadata: { contentType } });
    await c.env.DB.prepare(
      "INSERT INTO assets (id, user_id, r2_key, content_type, size, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
      .bind(id, user.id, key, contentType, bytes.byteLength, now())
      .run();

    const asset: Asset = { id, contentType, size: bytes.byteLength, url: `${API_PREFIX}/assets/${id}` };
    return json({ asset }, 201);
  });

  r.get("/assets/:id", async (c) => {
    const user = await requireUser(c);
    const row = await getAssetOwned(c.env.DB, c.params.id, user.id);

    // Resolve a conditional request with head(), so a 304 never fetches a body only to discard it.
    const inm = c.req.headers.get("If-None-Match");
    if (inm) {
      const head = await c.env.BUCKET.head(row.r2_key);
      if (!head) throw new HttpError(404, "Not found");
      if (etagMatches(inm, head.httpEtag)) {
        return new Response(null, {
          status: 304,
          headers: { ETag: head.httpEtag, "Cache-Control": CACHE_CONTROL, "Accept-Ranges": "bytes" },
        });
      }
    }

    const rangeHeader = c.req.headers.get("Range");
    const range = rangeHeader ? parseRange(rangeHeader, row.size) : "ignore";
    if (range === "unsatisfiable") return rangeNotSatisfiable(row.size);

    const obj = await c.env.BUCKET.get(row.r2_key, range === "ignore" ? undefined : { range });
    if (!obj) throw new HttpError(404, "Not found");

    const headers: Record<string, string> = {
      "Content-Type": row.content_type,
      ETag: obj.httpEtag,
      "Cache-Control": CACHE_CONTROL,
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    };
    if (range === "ignore") {
      return new Response(obj.body, { headers: { ...headers, "Content-Length": String(row.size) } });
    }
    // A satisfiable range answers 206 even when it covers the whole object: Safari's <audio> probes
    // with "bytes=0-" and only enables seeking if that probe comes back partial.
    return new Response(obj.body, {
      status: 206,
      headers: {
        ...headers,
        "Content-Length": String(range.length),
        "Content-Range": `bytes ${range.offset}-${range.offset + range.length - 1}/${row.size}`,
      },
    });
  });

  r.delete("/assets/:id", async (c) => {
    const user = await requireUser(c);
    const row = await getAssetOwned(c.env.DB, c.params.id, user.id);
    await c.env.BUCKET.delete(row.r2_key);
    await c.env.DB.prepare("DELETE FROM assets WHERE id = ?").bind(row.id).run();
    return new Response(null, { status: 204 });
  });
}
