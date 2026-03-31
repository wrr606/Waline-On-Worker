import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env, Variables } from './env.js';
import { auth } from './middleware/auth.js';
import { commentRoutes } from './router/comment.js';
import { articleRoutes } from './router/article.js';
import { userRoutes } from './router/user.js';
import { tokenRoutes } from './router/token.js';
import { settingsRoutes } from './router/settings.js';
import { oauthRoutes } from './router/oauth.js';
import { dbRoutes } from './router/db.js';
import { getWalinePage } from './ui/waline-page.js';
import { getAdminPage } from './ui/admin-panel.js';
import { getCustomSettingsPage, get404Page } from './ui/custom-admin.js';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const secureDomains = c.env.SECURE_DOMAINS;
      if (!secureDomains) return origin;
      const allowed = secureDomains.split(',').map((d: string) => d.trim());
      if (allowed.some((d: string) => origin === d || origin.endsWith(`.${d}`))) {
        return origin;
      }
      return '';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length', 'x-waline-version'],
    credentials: true,
  }),
);

// Waline version header (used by admin panel for export __version field)
app.use('*', async (c, next) => {
  await next();
  c.header('x-waline-version', '1.0.0');
});

// Auth middleware - parse JWT on all routes (non-blocking, skips if no token)
app.use('*', auth);

// Routes
app.route('/api/comment', commentRoutes);
app.route('/api/article', articleRoutes);
app.route('/api/user', userRoutes);
app.route('/api/token', tokenRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/oauth', oauthRoutes);
app.route('/api/db', dbRoutes);

// Worker custom settings page (server-side auth-gated)
app.get('/ui/worker-setting', async (c) => {
  const userInfo = c.get('userInfo');
  if (userInfo?.type !== 'administrator') {
    return c.html(get404Page(), 404);
  }
  return c.html(getCustomSettingsPage(c.req.url));
});

// Admin panel UI (original @waline/admin from CDN)
app.get('/ui', async (c) => {
  return c.html(await getAdminPage(c.env, c.req.url));
});
app.get('/ui/*', async (c) => {
  return c.html(await getAdminPage(c.env, c.req.url));
});

// Waline frontend UI (root page)
app.get('/', (c) => {
  return c.html(getWalinePage());
});

export default app;
