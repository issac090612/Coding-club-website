const JSONBIN_API = 'https://api.jsonbin.io/v3/b';
const MAX_BODY_BYTES = 16 * 1024;
const MAX_ITEMS = 500;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store',
    'Vary': 'Origin'
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function getAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return '';
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function requireConfiguration(env) {
  if (!env.JSONBIN_API_KEY || !env.JSONBIN_BIN_ID || env.JSONBIN_BIN_ID === 'REPLACE_WITH_YOUR_JSONBIN_BIN_ID') {
    throw new ApiError(500, 'The club database is not configured.');
  }
}

async function loadDatabase(env) {
  requireConfiguration(env);
  const response = await fetch(`${JSONBIN_API}/${encodeURIComponent(env.JSONBIN_BIN_ID)}/latest`, {
    headers: { 'X-Master-Key': env.JSONBIN_API_KEY }
  });
  if (!response.ok) throw new ApiError(502, 'The club database could not be read.');

  const payload = await response.json();
  const record = payload && payload.record;
  return {
    members: record && Array.isArray(record.members) ? record.members : [],
    showcases: record && Array.isArray(record.showcases) ? record.showcases : []
  };
}

async function saveDatabase(env, database) {
  const response = await fetch(`${JSONBIN_API}/${encodeURIComponent(env.JSONBIN_BIN_ID)}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': env.JSONBIN_API_KEY
    },
    body: JSON.stringify(database)
  });
  if (!response.ok) throw new ApiError(502, 'The club database could not be updated.');
}

function readText(input, field, maximum, required = false) {
  if (input === undefined || input === null) input = '';
  if (typeof input !== 'string') throw new ApiError(400, `${field} must be text.`);
  const value = input.trim();
  if (required && !value) throw new ApiError(400, `${field} is required.`);
  if (value.length > maximum) throw new ApiError(400, `${field} must be ${maximum} characters or fewer.`);
  return value;
}

function validateMember(input) {
  const name = readText(input.name, 'Name', 60, true);
  const email = readText(input.email, 'Email', 254);
  const make = readText(input.make, 'Project interests', 500);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'Please enter a valid email address, or leave it empty.');
  }
  return { name, email, make, date: new Date().toISOString() };
}

function validateShowcase(input) {
  const title = readText(input.title, 'Project title', 80, true);
  const name = readText(input.name, 'Your name', 60, true);
  const description = readText(input.description, 'Description', 500, true);
  const link = readText(input.link, 'Link', 2048);
  if (link) {
    let url;
    try {
      url = new URL(link);
    } catch (error) {
      throw new ApiError(400, 'Please enter a valid project link.');
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new ApiError(400, 'Links must start with http:// or https://');
    }
  }
  return { title, name, description, link: link || null, date: new Date().toISOString() };
}

async function readJson(request) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiError(415, 'Content-Type must be application/json.');
  }
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > MAX_BODY_BYTES) throw new ApiError(413, 'The submission is too large.');
  const body = await request.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES) {
    throw new ApiError(413, 'The submission is too large.');
  }
  try {
    const input = JSON.parse(body);
    if (!input || Array.isArray(input) || typeof input !== 'object') throw new Error();
    return input;
  } catch (error) {
    throw new ApiError(400, 'The request body must be a JSON object.');
  }
}

function publicMember(member) {
  return { name: member.name, date: member.date };
}

function publicShowcase(showcase) {
  return {
    title: showcase.title,
    name: showcase.name,
    description: showcase.description,
    link: typeof showcase.link === 'string' && /^https?:\/\//i.test(showcase.link) ? showcase.link : null,
    date: showcase.date
  };
}

export default {
  async fetch(request, env) {
    const origin = getAllowedOrigin(request, env);
    if (origin === null) {
      return jsonResponse({ error: 'This origin is not allowed.' }, 403, corsHeaders(''));
    }
    const headers = corsHeaders(origin);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });

    const url = new URL(request.url);
    const collection = url.pathname === '/api/members'
      ? 'members'
      : url.pathname === '/api/showcases' ? 'showcases' : '';
    if (!collection) return jsonResponse({ error: 'Not found.' }, 404, headers);
    if (request.method !== 'GET' && request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405, { ...headers, Allow: 'GET, POST, OPTIONS' });
    }

    try {
      if (request.method === 'GET') {
        const database = await loadDatabase(env);
        const items = collection === 'members'
          ? database.members.map(publicMember)
          : database.showcases.map(publicShowcase);
        return jsonResponse({ [collection]: items }, 200, headers);
      }

      const input = await readJson(request);
      const database = await loadDatabase(env);
      if (database[collection].length >= MAX_ITEMS) {
        throw new ApiError(507, 'This collection is full. Please contact the club organizer.');
      }

      if (collection === 'members') {
        const member = validateMember(input);
        database.members.push(member);
        await saveDatabase(env, database);
        return jsonResponse({ member: publicMember(member) }, 201, headers);
      }

      const showcase = validateShowcase(input);
      database.showcases.unshift(showcase);
      await saveDatabase(env, database);
      return jsonResponse({ showcase }, 201, headers);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : 500;
      const message = error instanceof ApiError ? error.message : 'The server could not complete the request.';
      if (status === 500) console.error(error);
      return jsonResponse({ error: message }, status, headers);
    }
  }
};
