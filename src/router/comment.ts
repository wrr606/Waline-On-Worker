import { Hono } from 'hono';
import type { Env, Variables } from '../env.js';
import { getAvatar } from '../utils/avatar.js';
import { parseUA } from '../utils/ua.js';
import { renderMarkdown } from '../utils/markdown.js';
import { reviewComment } from '../utils/llm-review.js';
import { getSetting } from './settings.js';

export const commentRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * GET /api/comment
 * Query params:
 *   - path (required): page path
 *   - page (int, default 1)
 *   - pageSize (int, default 10, max 100)
 *   - sortBy: insertedAt_desc | insertedAt_asc | like_desc
 *   - type: (optional) recent | count | list
 */
commentRoutes.get('/', async (c) => {
  const type = c.req.query('type');

  switch (type) {
    case 'recent':
      return getRecentComments(c);
    case 'count':
      return getCommentCount(c);
    case 'list':
      return getAdminCommentList(c);
    default:
      return getCommentList(c);
  }
});

/**
 * POST /api/comment - Create comment
 */
commentRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const { comment, nick, mail, link, url, ua, pid, rid, at } = body;

  if (!url) {
    return c.json({ errno: 1, errmsg: 'url is required' }, 400);
  }
  if (!comment) {
    return c.json({ errno: 1, errmsg: 'comment is required' }, 400);
  }

  const ip = c.req.header('CF-Connecting-IP') || '';
  const userInfo = c.get('userInfo');

  // Determine initial status:
  // - comment_default_status setting: anonymous users
  // - user_comment_default_status setting: logged-in users
  // - Fallback: AUDIT env var, then approved
  let status: string;
  if (userInfo) {
    const userDefault = await getSetting(c.env.DB, 'user_comment_default_status').catch(() => null);
    status = (userDefault === 'waiting') ? 'waiting' : 'approved';
  } else {
    const defaultStatus = await getSetting(c.env.DB, 'comment_default_status').catch(() => null);
    if (defaultStatus === 'waiting' || defaultStatus === 'approved') {
      status = defaultStatus;
    } else if (c.env.AUDIT) {
      status = 'waiting';
    } else {
      status = 'approved';
    }
  }

  // Render markdown to HTML
  const renderedComment = renderMarkdown(comment);

  const result = await c.env.DB.prepare(
    `INSERT INTO wl_Comment (user_id, comment, orig, ip, link, mail, nick, pid, rid, sticky, status, "like", ua, url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, ?)`,
  )
    .bind(
      userInfo?.objectId ?? null,
      renderedComment,
      comment,
      ip,
      link || '',
      userInfo?.email || mail || '',
      userInfo?.display_name || nick || '',
      pid || null,
      rid || null,
      status,
      ua || '',
      url,
    )
    .run();

  if (!result.success) {
    return c.json({ errno: 1, errmsg: 'Failed to create comment' }, 500);
  }

  const newComment = await c.env.DB.prepare(
    'SELECT * FROM wl_Comment WHERE id = last_insert_rowid()',
  ).first();

  // Async LLM review based on llm_mode and llm_skip_admin settings
  if (newComment) {
    const commentId = (newComment as any).id;
    const db = c.env.DB;
    c.executionCtx.waitUntil(
      (async () => {
        const llmMode = await getSetting(db, 'llm_mode').catch(() => null) || 'off';
        if (llmMode === 'off') return;
        if (llmMode === 'anonymous' && userInfo) return;
        // llmMode === 'all': review everyone, but check skip_admin
        if (userInfo?.type === 'administrator') {
          const skip = await getSetting(db, 'llm_skip_admin').catch(() => null);
          if (skip !== '0') return; // default: skip admin
        }
        const newStatus = await reviewComment(db, comment, nick || '', url, status);
        if (newStatus === status) return;
        await db.prepare(
          `UPDATE wl_Comment SET status = ?, updatedAt = datetime('now')
           WHERE id = ? AND status = ?`,
        ).bind(newStatus, commentId, status).run();
      })().catch(() => { /* LLM review failure is non-critical */ }),
    );
  }

  return c.json({
    errno: 0,
    errmsg: '',
    data: await formatComment(newComment),
  }, 201);
});

/**
 * PUT /api/comment/:id - Update comment
 */
commentRoutes.put('/:id', async (c) => {
  const id = c.req.param('id');
  const userInfo = c.get('userInfo');
  const body = await c.req.json();
  const isAdmin = userInfo?.type === 'administrator';

  // Like action (anyone can like - increment by 1)
  if (body.like !== undefined && typeof body.like === 'boolean') {
    await c.env.DB.prepare(
      'UPDATE wl_Comment SET "like" = MAX(0, "like" + 1), updatedAt = datetime(\'now\') WHERE id = ?',
    )
      .bind(id)
      .run();

    const updated = await c.env.DB.prepare(
      'SELECT * FROM wl_Comment WHERE id = ?',
    )
      .bind(id)
      .first();

    return c.json({ errno: 0, errmsg: '', data: await formatComment(updated) });
  }

  // Only admin can update other fields
  if (!isAdmin) {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 403);
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.status !== undefined) {
    updates.push('status = ?');
    values.push(body.status);
  }
  if (body.comment !== undefined) {
    updates.push('comment = ?');
    values.push(renderMarkdown(body.comment));
    updates.push('orig = ?');
    values.push(body.comment);
  }
  if (body.sticky !== undefined) {
    updates.push('sticky = ?');
    values.push(body.sticky ? 1 : 0);
  }
  if (body.nick !== undefined) {
    updates.push('nick = ?');
    values.push(body.nick);
  }
  if (body.mail !== undefined) {
    updates.push('mail = ?');
    values.push(body.mail);
  }
  if (body.link !== undefined) {
    updates.push('link = ?');
    values.push(body.link);
  }
  if (body.url !== undefined) {
    updates.push('url = ?');
    values.push(body.url);
  }
  if (body.ua !== undefined) {
    updates.push('ua = ?');
    values.push(body.ua);
  }
  if (body.ip !== undefined) {
    updates.push('ip = ?');
    values.push(body.ip);
  }
  if (body.user_id !== undefined) {
    updates.push('user_id = ?');
    values.push(body.user_id);
  }
  if (body.pid !== undefined) {
    updates.push('pid = ?');
    values.push(body.pid);
  }
  if (body.rid !== undefined) {
    updates.push('rid = ?');
    values.push(body.rid);
  }
  if (typeof body.like === 'number') {
    updates.push('"like" = ?');
    values.push(Math.max(0, body.like));
  }

  if (updates.length === 0) {
    return c.json({ errno: 1, errmsg: 'No fields to update' }, 400);
  }

  updates.push("updatedAt = datetime('now')");
  values.push(id);

  await c.env.DB.prepare(
    `UPDATE wl_Comment SET ${updates.join(', ')} WHERE id = ?`,
  )
    .bind(...values)
    .run();

  const updated = await c.env.DB.prepare(
    'SELECT * FROM wl_Comment WHERE id = ?',
  )
    .bind(id)
    .first();

  return c.json({ errno: 0, errmsg: '', data: await formatComment(updated) });
});

/**
 * DELETE /api/comment/:id - Delete comment (cascade)
 */
commentRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const userInfo = c.get('userInfo');

  if (userInfo?.type !== 'administrator') {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 403);
  }

  // Cascade delete: remove child comments
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM wl_Comment WHERE rid = ?').bind(id),
    c.env.DB.prepare('DELETE FROM wl_Comment WHERE id = ?').bind(id),
  ]);

  return c.json({ errno: 0, errmsg: '' });
});

/**
 * GET /api/comment/rss - RSS feed for comments
 * Query params:
 *   - path: filter by page path
 *   - email / user_id: get replies to a user's comments
 *   - count: number of items (default 20, max 50)
 */
commentRoutes.get('/rss', async (c) => {
  const path = c.req.query('path');
  const email = c.req.query('email');
  const userId = c.req.query('user_id');
  const count = parseInt(c.req.query('count') || '20');
  const limit = Math.min(Math.max(Number.isFinite(count) ? count : 20, 1), 50);

  const siteUrl = c.env.SITE_URL || '';
  const siteName = c.env.SITE_NAME || 'Waline';

  let comments: any[];

  if (path) {
    // Filter by page path
    const result = await c.env.DB.prepare(
      `SELECT id, comment, insertedAt, link, nick, url, user_id FROM wl_Comment
       WHERE url = ? AND status NOT IN ('waiting', 'spam')
       ORDER BY insertedAt DESC LIMIT ?`,
    )
      .bind(path, limit)
      .all();
    comments = result.results;
  } else if (email || userId) {
    // Get replies to a user's comments
    let parentQuery: string;
    const parentParams: string[] = [];

    if (email && userId) {
      parentQuery = `SELECT id FROM wl_Comment WHERE status NOT IN ('waiting', 'spam') AND (mail = ? OR user_id = ?)`;
      parentParams.push(email, userId);
    } else if (email) {
      parentQuery = `SELECT id FROM wl_Comment WHERE status NOT IN ('waiting', 'spam') AND mail = ?`;
      parentParams.push(email);
    } else {
      parentQuery = `SELECT id FROM wl_Comment WHERE status NOT IN ('waiting', 'spam') AND user_id = ?`;
      parentParams.push(userId!);
    }

    const parents = await c.env.DB.prepare(parentQuery).bind(...parentParams).all();
    const parentIds = parents.results.map((r: any) => r.id);

    if (parentIds.length === 0) {
      return rssResponse(c, buildRssXml({
        title: `${siteName} Reply Comments`,
        link: siteUrl,
        description: 'Recent reply comments.',
        items: [],
      }));
    }

    const placeholders = parentIds.map(() => '?').join(',');
    const result = await c.env.DB.prepare(
      `SELECT id, comment, insertedAt, link, nick, url, user_id FROM wl_Comment
       WHERE pid IN (${placeholders}) AND status NOT IN ('waiting', 'spam')
       ORDER BY insertedAt DESC LIMIT ?`,
    )
      .bind(...parentIds, limit)
      .all();
    comments = result.results;
  } else {
    // All recent comments
    const result = await c.env.DB.prepare(
      `SELECT id, comment, insertedAt, link, nick, url, user_id FROM wl_Comment
       WHERE status NOT IN ('waiting', 'spam')
       ORDER BY insertedAt DESC LIMIT ?`,
    )
      .bind(limit)
      .all();
    comments = result.results;
  }

  // Fetch user display names
  const userIds = [...new Set(comments.map((r: any) => r.user_id).filter(Boolean))];
  let users: any[] = [];
  if (userIds.length > 0) {
    const placeholders = userIds.map(() => '?').join(',');
    const userResult = await c.env.DB.prepare(
      `SELECT id, display_name, url FROM wl_Users WHERE id IN (${placeholders})`,
    )
      .bind(...userIds)
      .all();
    users = userResult.results;
  }

  // Build RSS items
  const items = comments.map((comment: any) => {
    const user = users.find((u: any) => u.id === comment.user_id);
    const nick = user?.display_name || comment.nick || 'Anonymous';
    const commentUrl = buildAbsoluteUrl(siteUrl, comment.url);
    const itemLink = commentUrl ? `${commentUrl}#${comment.id}` : '';

    return {
      title: `${nick} commented${comment.url ? ` on ${comment.url}` : ''}`,
      link: itemLink || commentUrl,
      guid: String(comment.id),
      pubDate: comment.insertedAt ? new Date(comment.insertedAt + 'Z').toUTCString() : new Date().toUTCString(),
      description: comment.comment || '',
    };
  });

  const title = path
    ? `${siteName} Comments for ${path}`
    : email || userId
      ? `${siteName} Reply Comments`
      : `${siteName} Recent Comments`;
  const description = path
    ? `Recent comments for ${path}.`
    : email || userId
      ? 'Recent reply comments.'
      : 'Recent comments.';

  return rssResponse(c, buildRssXml({ title, link: siteUrl, description, items }));
});

// --- Helper functions ---

async function getCommentList(c: any) {
  const path = c.req.query('path');
  if (!path) {
    return c.json({ errno: 1, errmsg: 'path is required' }, 400);
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '10')));
  const sortBy = c.req.query('sortBy') || 'insertedAt_desc';

  const orderMap: Record<string, string> = {
    insertedAt_desc: 'insertedAt DESC',
    insertedAt_asc: 'insertedAt ASC',
    like_desc: '"like" DESC',
  };
  const orderBy = orderMap[sortBy] || 'insertedAt DESC';
  const offset = (page - 1) * pageSize;

  // Count total root comments
  const countResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM wl_Comment WHERE url = ? AND rid IS NULL AND pid IS NULL AND status = 'approved'",
  )
    .bind(path)
    .first();
  const totalCount = (countResult?.count as number) || 0;

  // Get root comments (sticky first)
  const rootComments = await c.env.DB.prepare(
    `SELECT * FROM wl_Comment
     WHERE url = ? AND rid IS NULL AND pid IS NULL AND status = 'approved'
     ORDER BY sticky DESC, ${orderBy}
     LIMIT ? OFFSET ?`,
  )
    .bind(path, pageSize, offset)
    .all();

  // Get child comments for these roots
  const rootIds = rootComments.results.map((r: any) => r.id);
  let children: any[] = [];
  if (rootIds.length > 0) {
    const placeholders = rootIds.map(() => '?').join(',');
    const childResult = await c.env.DB.prepare(
      `SELECT * FROM wl_Comment
       WHERE rid IN (${placeholders}) AND status = 'approved'
       ORDER BY insertedAt ASC`,
    )
      .bind(...rootIds)
      .all();
    children = childResult.results;
  }

  // Build threaded structure
  const data = await Promise.all(
    rootComments.results.map(async (root: any) => ({
      ...(await formatComment(root)),
      children: await Promise.all(
        children
          .filter((child: any) => child.rid === root.id)
          .map((child: any) => formatComment(child)),
      ),
    })),
  );

  return c.json({
    errno: 0,
    errmsg: '',
    data: {
      page,
      pageSize,
      count: totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      data,
    },
  });
}

async function getRecentComments(c: any) {
  const count = Math.min(50, Math.max(1, parseInt(c.req.query('count') || '10')));

  const result = await c.env.DB.prepare(
    `SELECT * FROM wl_Comment WHERE status = 'approved'
     ORDER BY insertedAt DESC LIMIT ?`,
  )
    .bind(count)
    .all();

  return c.json({
    errno: 0,
    errmsg: '',
    data: await Promise.all(result.results.map((r: any) => formatComment(r))),
  });
}

async function getCommentCount(c: any) {
  const paths = c.req.queries('path') || c.req.queries('path[]') || [];
  if (paths.length === 0) {
    return c.json({ errno: 0, errmsg: '', data: 0 });
  }

  if (paths.length === 1) {
    const result = await c.env.DB.prepare(
      "SELECT COUNT(*) as count FROM wl_Comment WHERE url = ? AND status = 'approved'",
    )
      .bind(paths[0])
      .first();
    return c.json({
      errno: 0,
      errmsg: '',
      data: [(result?.count as number) || 0],
    });
  }

  const placeholders = paths.map(() => '?').join(',');
  const result = await c.env.DB.prepare(
    `SELECT url, COUNT(*) as count FROM wl_Comment
     WHERE url IN (${placeholders}) AND status = 'approved'
     GROUP BY url`,
  )
    .bind(...paths)
    .all();

  const countMap = Object.fromEntries(
    result.results.map((r: any) => [r.url, r.count]),
  );
  return c.json({
    errno: 0,
    errmsg: '',
    data: paths.map((u: string) => countMap[u] || 0),
  });
}

async function getAdminCommentList(c: any) {
  const userInfo = c.get('userInfo');
  if (userInfo?.type !== 'administrator') {
    return c.json({ errno: 1, errmsg: 'Unauthorized' }, 403);
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '10')));
  const status = c.req.query('status') || '';
  const keyword = c.req.query('keyword') || '';
  const offset = (page - 1) * pageSize;

  let where = '1=1';
  const params: unknown[] = [];

  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }
  if (keyword) {
    where += ' AND comment LIKE ?';
    params.push(`%${keyword}%`);
  }

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM wl_Comment WHERE ${where}`,
  )
    .bind(...params)
    .first();

  const result = await c.env.DB.prepare(
    `SELECT * FROM wl_Comment WHERE ${where}
     ORDER BY insertedAt DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all();

  return c.json({
    errno: 0,
    errmsg: '',
    data: {
      page,
      pageSize,
      spamCount: 0,
      waitingCount: 0,
      totalPages: Math.ceil(((countResult?.count as number) || 0) / pageSize),
      data: await Promise.all(result.results.map((r: any) => formatComment(r, true))),
    },
  });
}

async function formatComment(row: any, isAdmin = false) {
  if (!row) return null;
  const { browser, os } = parseUA(row.ua || '');
  const avatar = await getAvatar(row.mail || '');
  const result: Record<string, any> = {
    objectId: row.id,
    comment: row.comment || '',
    orig: row.orig || row.comment || '',
    nick: row.nick || '',
    link: row.link || '',
    avatar,
    browser,
    os,
    time: new Date(row.insertedAt + 'Z').getTime(),
    insertedAt: row.insertedAt ? row.insertedAt + 'Z' : '',
    createdAt: row.createdAt ? row.createdAt + 'Z' : '',
    status: row.status,
    like: row.like || 0,
    url: row.url,
    pid: row.pid,
    rid: row.rid,
    sticky: Boolean(row.sticky),
    user_id: row.user_id,
  };

  if (isAdmin) {
    result.mail = row.mail || '';
    result.ip = row.ip || '';
    result.ua = row.ua || '';
  }

  return result;
}

// --- RSS helpers ---

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildAbsoluteUrl(baseUrl: string, path: string | undefined): string {
  if (!path) return baseUrl || '';
  if (/^(https?:)?\/\//i.test(path)) return path;
  if (!baseUrl) return path;
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function buildRssXml({ title, link, description, items }: {
  title: string;
  link: string;
  description: string;
  items: { title: string; link: string; guid: string; pubDate: string; description: string }[];
}): string {
  const now = new Date().toUTCString();
  const itemsXml = items
    .map(
      (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid>${escapeXml(item.guid)}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description><![CDATA[${item.description}]]></description>
    </item>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
    <pubDate>${now}</pubDate>
${itemsXml}
  </channel>
</rss>`;
}

function rssResponse(c: any, xml: string): Response {
  return c.body(xml, 200, {
    'Content-Type': 'application/rss+xml; charset=utf-8',
  });
}
