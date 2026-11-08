// Cloudflare Worker — family-tree API proxy
// يحفظ ويقرأ data.json والصور من GitHub

const GITHUB_TOKEN = GITHUB_TOKEN_ENV; // يُضبط من Cloudflare Worker Environment Variables
const REPO = 'abdulhamid-nahhas/family-tree';
const BRANCH = 'main';
const DATA_FILE = 'data.json';
const PHOTOS_DIR = 'photos';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function githubGet(path) {
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    headers: { Authorization: `token ${GITHUB_TOKEN}`, 'User-Agent': 'family-tree' }
  });
  if (!r.ok) return null;
  return r.json();
}

async function githubPut(path, content, sha, message) {
  const body = { message, content: btoa(unescape(encodeURIComponent(content))), branch: BRANCH };
  if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'family-tree'
    },
    body: JSON.stringify(body)
  });
  return r.json();
}

async function githubPutBinary(path, base64content, sha, message) {
  const body = { message, content: base64content, branch: BRANCH };
  if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'family-tree'
    },
    body: JSON.stringify(body)
  });
  return r.json();
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // GET /data — قراءة البيانات
    if (request.method === 'GET' && path === '/data') {
      const file = await githubGet(DATA_FILE);
      if (!file) {
        return new Response(JSON.stringify({ FAM: {}, sha: null }), {
          headers: { ...CORS, 'Content-Type': 'application/json' }
        });
      }
      const content = decodeURIComponent(escape(atob(file.content.replace(/\n/g, ''))));
      return new Response(JSON.stringify({ data: JSON.parse(content), sha: file.sha }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // POST /data — حفظ البيانات
    if (request.method === 'POST' && path === '/data') {
      const { data, sha } = await request.json();
      const result = await githubPut(DATA_FILE, JSON.stringify(data, null, 2), sha, 'update: family data');
      return new Response(JSON.stringify({ sha: result.content?.sha }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    // POST /photo — رفع صورة
    if (request.method === 'POST' && path === '/photo') {
      const { id, base64, ext } = await request.json();
      const filePath = `${PHOTOS_DIR}/${id}.${ext}`;
      const existing = await githubGet(filePath);
      const result = await githubPutBinary(filePath, base64, existing?.sha || null, `photo: ${id}`);
      const photoUrl = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/${filePath}`;
      return new Response(JSON.stringify({ url: photoUrl, sha: result.content?.sha }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    return new Response('not found', { status: 404, headers: CORS });
  }
};
