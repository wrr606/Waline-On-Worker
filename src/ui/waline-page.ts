import type { Env } from '../env.js';
import { getSettings } from '../router/settings.js';

/**
 * Waline frontend UI page HTML
 * Faithfully reproduces the original Waline server root page behavior
 * with configurable @waline/client version and worker_display setting
 */
export async function getWalinePage(env: Env, requestUrl: string, isAdmin = false): Promise<string> {
  const settings = await getSettings(env.DB, ['waline_client_version', 'worker_display']).catch(() => ({} as Record<string, string>));
  const clientVersion = settings['waline_client_version'] || 'v3';
  const workerDisplay = settings['worker_display'] || 'admin';
  const url = new URL(requestUrl);
  const serverURL = `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
  const origin = url.origin;

  const turnstileKey = env.TURNSTILE_KEY || '';
  const recaptchaKey = env.RECAPTCHA_V3_KEY || '';

  // Determine worker info display mode
  const showAlways = workerDisplay === 'always';
  const showAdmin = workerDisplay === 'admin';
  // For 'admin' + known admin (via URL ?token=): render directly
  // For 'admin' + unknown: inject client-side check script
  const directShow = showAlways || (showAdmin && isAdmin);
  const clientCheck = showAdmin && !isAdmin;

  const workerConsoleLog = `
    console.log(
      '%c @waline-on-worker %c v0.1.0 ',
      'color: white; background: #f97316; padding:5px 0;',
      'padding:4px;border:1px solid #f97316;'
    );`;

  const workerBadgeHtml = `<div style="text-align:center;margin:20px 0;font-size:12px;color:#999">Powered by <a href="https://github.com/aspect-apps/waline-on-worker" style="color:#f97316;text-decoration:none">Waline on Worker</a> v0.1.0</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Waline Example</title>
</head>
<body>
  <div id="waline" style="max-width: 800px;margin: 0 auto;"></div>
${directShow ? `  <div id="wk-badge">${workerBadgeHtml}</div>` : ''}
${clientCheck ? `  <div id="wk-badge" style="display:none">${workerBadgeHtml}</div>` : ''}
  <link href='//unpkg.com/@waline/client@${escapeHtml(clientVersion)}/dist/waline.css' rel='stylesheet' />
  <script type="module">
    import { init } from 'https://unpkg.com/@waline/client@${escapeHtml(clientVersion)}/dist/waline.js';

    console.log(
      '%c @waline/server %c v1.39.3 ',
      'color: white; background: #0078E7; padding:5px 0;',
      'padding:4px;border:1px solid #0078E7;'
    );
${directShow ? workerConsoleLog : ''}
    const params = new URLSearchParams(location.search.slice(1));
    const waline = init({
      el: '#waline',
      path: params.get('path') || '/',
      lang: params.get('lng') || undefined,
      serverURL: '${serverURL}',
      ${recaptchaKey ? `recaptchaV3Key: '${escapeHtml(recaptchaKey)}',` : ''}
      ${turnstileKey ? `turnstileKey: '${escapeHtml(turnstileKey)}',` : ''}
    });
  </script>
${clientCheck ? `  <script>
  (function(){
    var tk = localStorage.getItem('TOKEN') || sessionStorage.getItem('TOKEN');
    if (!tk) return;
    fetch(${JSON.stringify(origin)} + '/api/token', {
      headers: { Authorization: 'Bearer ' + tk }
    }).then(function(r){ return r.json(); }).then(function(d){
      if (d.errno === 0 && d.data && d.data.type === 'administrator') {
        ${workerConsoleLog.trim()}
        var b = document.getElementById('wk-badge');
        if (b) b.style.display = '';
      }
    }).catch(function(){});
  })();
  </script>` : ''}
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
