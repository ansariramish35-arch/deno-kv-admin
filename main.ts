import { Hono } from "https://deno.land/x/hono@v3.4.1/mod.ts";
import { HTTPException } from "https://deno.land/x/hono@v3.12.10/http-exception.ts";

const app = new Hono();
const kv = await Deno.openKv();

// Basic KV operations to support admin interface

// Set a record by key (POST body is JSON)
app.post("/kv/set/:key{.*}", async (c) => {
  checkToken(c);
  const key = c.req.param("key");
  const body = await c.req.json();
  const result = await kv.set(key.split('/'), body);
  return c.json(result);
});

// Get a record by key
app.get("/kv/get/:key{.*}", async (c) => {
  checkToken(c);
  const key = c.req.param("key");
  const result = await kv.get(key.split('/'));
  return c.json(result);
});

// List records with a key prefix
app.get("/kv/list/:key{.*}", async (c) => {
  checkToken(c);
  const key = c.req.param("key");
  const cursor = c.req.query("cursor");
  const extra: Record<string, unknown> = { 'limit': 100 };
  if (typeof cursor == 'string' && cursor.length > 0) {
    extra['cursor'] = cursor;
  }
  const iter = await kv.list({ prefix: key.split('/') }, extra);
  const records = [];
  for await (const entry of iter) {
    records.push(entry);
  }
  return c.json({ 'records': records, 'cursor': iter.cursor });
});

// Delete a record
app.delete("/kv/delete/:key{.*}", async (c) => {
  checkToken(c);
  const key = c.req.param("key");
  const result = await kv.delete(key.split('/'));
  return c.json(result);
});

// Delete a prefix
app.delete("/kv/delete_prefix/:key{.*}", async (c) => {
  checkToken(c);
  const key = c.req.param("key");
  const iter = await kv.list({ prefix: key.split('/') });
  const keys = [];
  for await (const entry of iter) {
    await kv.delete(entry.key);
    keys.push(entry.key);
  }
  console.log("Keys with prefix", key, "deleted:", keys.length);
  return c.json({ 'keys': keys });
});

// Full database reset
app.delete("/kv/full_reset_42", async (c) => {
  checkToken(c);
  const iter = await kv.list({ prefix: [] });
  const keys = [];
  for await (const entry of iter) {
    await kv.delete(entry.key);
    keys.push(entry);
  }
  console.log("Database reset keys deleted:", keys.length);
  return c.json({ 'keys': keys });
});

// Dump the request object for learning and debugging
app.all('/dump/*', async (c) => {
  const req = c.req;

  const method = req.method;
  const url = req.url;
  const path = req.path;
  const query = req.query();
  const headers: Record<string, string> = {};
  for (const [key, value] of req.raw.headers.entries()) {
    headers[key] = value;
  }

  let body: unknown = null;
  try {
    body = await req.json();
  } catch {
    try {
      body = await req.text();
    } catch {
      body = null;
    }
  }

  const dump = {
    method,
    url,
    path,
    headers,
    query,
    body,
  };

  return c.json(dump, 200);
});

// Make sure we return the correct HTTP Status code when we throw an exception
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.text(err.message, err.status);
  }
  return c.text('Internal Server Error', 500);
});

// Insure security - Updated with your PG4E assignment token
function checkToken(c: any) {
  const token = c.req.query("token");
  if (token == '2702_a0c240:0c45f4') return true;
  throw new HTTPException(401, { message: 'Missing or invalid token' });
}

const port = Number(Deno.env.get("PORT")) || 8000;
Deno.serve({ port }, app.fetch);
