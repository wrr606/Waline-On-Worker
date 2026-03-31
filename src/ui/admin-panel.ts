/**
 * Admin Panel - loads @waline/admin from CDN (matching original Waline implementation)
 * Includes Worker branding and menu injection based on worker_display setting
 * Menu injection uses client-side API check (server-side auth validation) so it
 * works on first login without page refresh
 */
import type { Env } from '../env.js';
import { getSetting } from '../router/settings.js';

export async function getAdminPage(env: Env, requestUrl: string): Promise<string> {
  const workerDisplay = await getSetting(env.DB, 'worker_display').catch(() => null) || 'admin';
  const url = new URL(requestUrl);
  const serverURL = `${url.origin}/api/`;
  const siteName = env.SITE_NAME || '';
  const siteUrl = env.SITE_URL || '';
  const recaptchaV3Key = env.RECAPTCHA_V3_KEY || '';
  const turnstileKey = env.TURNSTILE_KEY || '';
  const origin = url.origin;

  const showWorker = workerDisplay !== 'disabled';
  const showAlways = workerDisplay === 'always';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Waline Management System</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
${showWorker ? `  <style>.wk-badge{display:inline-block;margin-left:12px;padding:1px 8px;background:#f97316;color:#fff;font-size:11px;border-radius:10px;vertical-align:middle;font-weight:normal;letter-spacing:.5px;line-height:18px}</style>` : ''}
</head>
<body>
  <script>
    window.serverURL = ${JSON.stringify(serverURL)};
    window.SITE_NAME = ${JSON.stringify(siteName || undefined)};
    window.SITE_URL = ${JSON.stringify(siteUrl || undefined)};
    window.recaptchaV3Key = ${JSON.stringify(recaptchaV3Key || undefined)};
    window.turnstileKey = ${JSON.stringify(turnstileKey || undefined)};
  </script>
  <script src="//unpkg.com/@waline/admin"></script>
${showWorker ? `  <script>
  (function(){
    var ORIGIN = ${JSON.stringify(origin)};
    var ALWAYS = ${JSON.stringify(showAlways)};
    var menuDone = false, badgeDone = false;

    function addBadge() {
      if (badgeDone) return;
      var op = document.querySelector('.typecho-head-nav .operate');
      if (!op) return;
      badgeDone = true;
      var s = document.createElement('span');
      s.className = 'wk-badge';
      s.textContent = 'Worker v0.1.0';
      op.insertBefore(s, op.firstChild);
    }

    function addMenu(tk) {
      if (menuDone) return;
      var nav = document.querySelector('#typecho-nav-list .child');
      if (!nav) return;
      menuDone = true;
      var li = document.createElement('li');
      li.className = 'last';
      var a = document.createElement('a');
      a.href = '/ui/worker-setting?token=' + encodeURIComponent(tk);
      a.textContent = 'Worker';
      li.appendChild(a);
      nav.appendChild(li);
    }

    function tryInject() {
      if (ALWAYS && !badgeDone) addBadge();
      if (menuDone && badgeDone) return;
      var tk = window.TOKEN || localStorage.getItem('TOKEN') || sessionStorage.getItem('TOKEN');
      if (!tk && !ALWAYS) return;
      if (tk && !menuDone) {
        fetch(ORIGIN + '/api/token', {
          headers: { Authorization: 'Bearer ' + tk }
        }).then(function(r){ return r.json(); }).then(function(d){
          if (d.errno === 0 && d.data && d.data.type === 'administrator') {
            addMenu(tk);
            addBadge();
          }
        }).catch(function(){});
      }
    }

    var ob = new MutationObserver(function(){ tryInject(); });
    ob.observe(document.body, { childList: true, subtree: true });
    var iv = setInterval(function(){ tryInject(); if (menuDone) clearInterval(iv); }, 2000);
    setTimeout(tryInject, 500);
  })();
  </script>` : ''}
</body>
</html>`;
}
