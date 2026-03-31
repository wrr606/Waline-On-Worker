/**
 * Worker Settings Page - Typecho-style admin page for non-standard Waline features
 * Served at /ui/worker-setting, server-side auth-gated (only admins see this page)
 */

/**
 * Returns a genuine-looking 404 page for non-admin visitors
 */
export function get404Page(): string {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>404 Not Found</title></head>
<body style="font-family:sans-serif;text-align:center;margin-top:120px;color:#656d76">
<h1 style="font-size:48px;margin-bottom:8px">404</h1><p>Not Found</p>
</body>
</html>`;
}

/**
 * Returns the full Typecho-styled settings page (only served to authenticated admins)
 */
export function getCustomSettingsPage(requestUrl: string): string {
  const url = new URL(requestUrl);
  const apiBase = url.origin;

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Worker Settings - Waline Management</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
/* Typecho admin theme */
*{box-sizing:border-box}
body{margin:0;font:87.5%/1.5 'Helvetica Neue',Helvetica,Arial,sans-serif;background:#f6f6f3;color:#444}
a{color:#467b96;text-decoration:none}a:hover{color:#499bc3}

/* Navigation */
.typecho-head-nav{padding:0 10px;background:#292d33;height:36px;line-height:36px}
.typecho-head-nav .inner{max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
.typecho-head-nav .nav-links{display:flex;align-items:center;gap:0}
.typecho-head-nav a{color:#bbb;padding:0 20px;display:inline-block;height:36px;line-height:36px;font-size:13px}
.typecho-head-nav a:hover,.typecho-head-nav a.focus{color:#fff;background:#202328;text-decoration:none}
.typecho-head-nav .nav-sep{border-right:1px solid #383d45}
.typecho-head-nav .operate{margin-left:auto}

/* Page title */
.typecho-page-title{max-width:960px;margin:30px auto 0;padding:0 10px}
.typecho-page-title h2{font-size:1.28571em;margin:0 0 10px;font-weight:400}

/* Content */
.container{max-width:960px;margin:20px auto;padding:0 10px}

/* Options/form */
.typecho-option-tabs{list-style:none;margin:0 0 -1px;padding:0;display:flex;border-bottom:1px solid #d9d9d6}
.typecho-option-tabs li{margin:0}
.typecho-option-tabs li a{display:block;padding:8px 20px;color:#444;border:1px solid transparent;border-bottom:none;margin-bottom:-1px;font-size:13px}
.typecho-option-tabs li.active a{background:#fff;border-color:#d9d9d6;border-bottom-color:#fff;font-weight:bold}
.typecho-option-tabs li a:hover{color:#467b96;text-decoration:none}

.typecho-table-wrap{padding:30px;background:#fff;border:1px solid #d9d9d6;border-top:none}

.typecho-option{margin-bottom:20px}
.typecho-option .typecho-label{display:block;margin-bottom:.5em;font-weight:bold;font-size:13px}
.typecho-option .description{margin:.5em 0 0;color:#999;font-size:12px}

input[type="text"],input[type="password"],input[type="url"],textarea,select{
  background:#fff;border:1px solid #d9d9d6;padding:7px;border-radius:2px;font-size:13px;font-family:inherit;outline:none;
}
input[type="text"]:focus,input[type="password"]:focus,input[type="url"]:focus,textarea:focus,select:focus{
  border-color:#467b96;box-shadow:0 0 0 2px rgba(70,123,150,.15);
}
input[type="text"],input[type="password"],input[type="url"]{width:100%;max-width:480px}
textarea{width:100%;max-width:480px;resize:vertical;min-height:80px;line-height:1.5}
select{height:32px;min-width:200px}

/* Version picker */
.version-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.version-row input{flex:1;max-width:320px}
.version-row select{flex:0 0 auto;max-width:200px}
.version-row .btn{flex:0 0 auto}

/* Toggle */
.toggle-row{display:flex;align-items:center;gap:10px}
.toggle{position:relative;display:inline-block;width:40px;height:22px;vertical-align:middle}
.toggle input{opacity:0;width:0;height:0}
.toggle-slider{position:absolute;cursor:pointer;inset:0;background:#ccc;border-radius:22px;transition:.2s}
.toggle-slider:before{content:"";position:absolute;height:16px;width:16px;left:3px;bottom:3px;background:#fff;border-radius:50%;transition:.2s}
.toggle input:checked+.toggle-slider{background:#467b96}
.toggle input:checked+.toggle-slider:before{transform:translateX(18px)}
.toggle-label{font-size:13px;color:#666}

/* Buttons */
.btn{border:none;background:#e9e9e6;cursor:pointer;border-radius:2px;display:inline-block;padding:0 12px;height:32px;color:#666;font-size:13px;vertical-align:middle;line-height:32px}
.btn:hover{background:#dbdbd6;transition:.2s}
.primary{background:#467b96;color:#fff}
.primary:hover{background:#3c6a81}
.btn-warn{background:#b94a48;color:#fff}
.btn-warn:hover{background:#a4403f}
.btn-xs{padding:0 10px;height:25px;font-size:12px;line-height:25px}
.actions{margin-top:20px;display:flex;gap:8px}

/* Toast */
.toast{position:fixed;top:16px;right:16px;padding:10px 16px;border-radius:2px;font-size:13px;z-index:100;animation:fadeIn .2s}
.toast-ok{background:#e6efc2;color:#264409}.toast-err{background:#fbe3e4;color:#8a1f11}
@keyframes fadeIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}

/* Loading spinner */
.spinner{display:inline-block;width:14px;height:14px;border:2px solid #ccc;border-top-color:#467b96;border-radius:50%;animation:spin .6s linear infinite;vertical-align:middle;margin-left:6px}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>

<!-- Navigation -->
<div class="typecho-head-nav">
  <div class="inner">
    <div class="nav-links">
      <a href="/ui" class="nav-sep">管理</a>
      <a href="/ui" class="nav-sep">评论</a>
      <a href="/ui/worker-setting" class="focus nav-sep">Worker</a>
    </div>
    <div class="operate">
      <a href="/">← 返回首页</a>
    </div>
  </div>
</div>

<!-- Title -->
<div class="typecho-page-title">
  <h2>Worker 设置</h2>
</div>

<!-- Content -->
<div class="container">
  <!-- Tab bar -->
  <ul class="typecho-option-tabs" id="tabs">
    <li class="active"><a href="#" data-tab="frontend">前端版本</a></li>
    <li><a href="#" data-tab="comment">评论策略</a></li>
    <li><a href="#" data-tab="llm">LLM 审查</a></li>
  </ul>

  <!-- Tab: Frontend Version -->
  <div class="typecho-table-wrap tab-panel" id="tab-frontend">
    <div class="typecho-option">
      <label class="typecho-label">@waline/client CDN 版本</label>
      <div class="version-row">
        <input type="text" id="set-version" placeholder="v3" />
        <select id="version-select">
          <option value="">选择版本…</option>
          <option value="latest">latest</option>
        </select>
        <button class="btn btn-xs" id="refresh-versions" title="刷新版本列表">↻ 刷新</button>
      </div>
      <p class="description">从 unpkg CDN 加载的 @waline/client 版本。可输入版本号（如 <code>v3</code>、<code>3.3.2</code>）或从下拉菜单选择。</p>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">Worker 信息显示</label>
      <select id="set-worker-display">
        <option value="always">始终显示</option>
        <option value="admin" selected>仅管理员登录</option>
        <option value="disabled">禁用</option>
      </select>
      <p class="description">控制 Waline on Worker 标识在页面和控制台中的可见性。「始终」对所有人可见，「仅管理员」仅管理员登录后可见，「禁用」完全隐藏。</p>
    </div>
  </div>

  <!-- Tab: Comment Policy -->
  <div class="typecho-table-wrap tab-panel" id="tab-comment" style="display:none">
    <div class="typecho-option">
      <label class="typecho-label">匿名评论默认状态</label>
      <select id="set-comment-status">
        <option value="approved">直接通过 (approved)</option>
        <option value="waiting">等待审核 (waiting)</option>
      </select>
      <p class="description">未登录用户发表评论的默认状态。已登录用户的评论始终直接通过。此设置优先于环境变量 AUDIT。</p>
    </div>
  </div>

  <!-- Tab: LLM Review -->
  <div class="typecho-table-wrap tab-panel" id="tab-llm" style="display:none">
    <div class="typecho-option">
      <label class="typecho-label">启用 LLM 审查</label>
      <div class="toggle-row">
        <label class="toggle"><input type="checkbox" id="set-llm-on" /><span class="toggle-slider"></span></label>
        <span class="toggle-label">对匿名评论使用 LLM 进行自动审查</span>
      </div>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">API Endpoint</label>
      <input type="url" id="set-llm-ep" placeholder="https://api.openai.com/v1/chat/completions" />
      <p class="description">OpenAI 兼容的 Chat Completions 端点</p>
    </div>
    <div class="typecho-option">
      <label class="typecho-label">API Key</label>
      <input type="password" id="set-llm-key" placeholder="sk-..." />
    </div>
    <div class="typecho-option">
      <label class="typecho-label">Model</label>
      <input type="text" id="set-llm-model" placeholder="gpt-4o-mini" />
    </div>
    <div class="typecho-option">
      <label class="typecho-label">System Prompt</label>
      <textarea id="set-llm-prompt" rows="6" placeholder="You are a review bot. Output a single word: approved or spam."></textarea>
    </div>
  </div>

  <!-- Actions -->
  <div class="actions">
    <button class="btn primary" id="save-btn">保存设置</button>
    <button class="btn" id="test-btn">测试 LLM</button>
  </div>
</div>

<script>
(function(){
  var API = ${JSON.stringify(apiBase)};
  var token = localStorage.getItem('TOKEN') || sessionStorage.getItem('TOKEN');

  function esc(s) { if (!s) return ''; var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

  function toast(msg, ok) {
    var el = document.createElement('div');
    el.className = 'toast ' + (ok ? 'toast-ok' : 'toast-err');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function(){ el.remove(); }, 3000);
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return fetch(API + '/api' + path, Object.assign({}, opts, { headers: headers })).then(function(r){ return r.json(); });
  }

  // Tab switching
  var tabs = document.querySelectorAll('.typecho-option-tabs a');
  var panels = document.querySelectorAll('.tab-panel');
  tabs.forEach(function(tab) {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      var target = this.getAttribute('data-tab');
      tabs.forEach(function(t){ t.parentElement.classList.remove('active'); });
      this.parentElement.classList.add('active');
      panels.forEach(function(p){ p.style.display = 'none'; });
      document.getElementById('tab-' + target).style.display = '';
    });
  });

  // Fetch npm versions via jsdelivr API
  function fetchVersions() {
    var btn = document.getElementById('refresh-versions');
    var sel = document.getElementById('version-select');
    btn.disabled = true;
    btn.innerHTML = '↻<span class="spinner"></span>';
    fetch('https://data.jsdelivr.com/v1/packages/npm/@waline/client')
      .then(function(r){ return r.json(); })
      .then(function(data) {
        sel.innerHTML = '<option value="">选择版本…</option><option value="latest">latest' +
          (data.tags && data.tags.latest ? ' (' + esc(data.tags.latest) + ')' : '') + '</option>';
        if (data.versions) {
          data.versions.slice(0, 30).forEach(function(v) {
            var opt = document.createElement('option');
            opt.value = v.version;
            opt.textContent = v.version;
            sel.appendChild(opt);
          });
        }
        toast('版本列表已刷新', true);
      })
      .catch(function(e){ toast('获取版本失败: ' + e.message, false); })
      .finally(function(){ btn.disabled = false; btn.textContent = '↻ 刷新'; });
  }

  document.getElementById('refresh-versions').addEventListener('click', fetchVersions);
  document.getElementById('version-select').addEventListener('change', function() {
    if (this.value) document.getElementById('set-version').value = this.value;
  });

  // Load settings
  api('/settings').then(function(sr) {
    var s = sr.data || {};
    document.getElementById('set-version').value = s.waline_client_version || 'v3';
    document.getElementById('set-comment-status').value = s.comment_default_status || 'approved';
    document.getElementById('set-worker-display').value = s.worker_display || 'admin';
    document.getElementById('set-llm-on').checked = s.llm_enabled === '1';
    document.getElementById('set-llm-ep').value = s.llm_endpoint || '';
    document.getElementById('set-llm-key').value = s.llm_api_key || '';
    document.getElementById('set-llm-model').value = s.llm_model || 'gpt-4o-mini';
    document.getElementById('set-llm-prompt').value = s.llm_prompt || 'You are a review bot. Output a single word: approved or spam.';

    // Match selected version in dropdown
    var sel = document.getElementById('version-select');
    var ver = s.waline_client_version || 'v3';
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === ver) { sel.selectedIndex = i; break; }
    }
  }).catch(function(){ toast('加载设置失败', false); });

  // Auto-fetch versions on load
  fetchVersions();

  // Save
  document.getElementById('save-btn').addEventListener('click', function() {
    var settings = {
      waline_client_version: document.getElementById('set-version').value.trim() || 'v3',
      comment_default_status: document.getElementById('set-comment-status').value,
      worker_display: document.getElementById('set-worker-display').value,
      llm_enabled: document.getElementById('set-llm-on').checked ? '1' : '0',
      llm_endpoint: document.getElementById('set-llm-ep').value.trim(),
      llm_api_key: document.getElementById('set-llm-key').value.trim(),
      llm_model: document.getElementById('set-llm-model').value.trim(),
      llm_prompt: document.getElementById('set-llm-prompt').value.trim(),
    };
    api('/settings', { method: 'PUT', body: JSON.stringify(settings) }).then(function(r) {
      toast(r.errno ? (r.errmsg || '保存失败') : '设置已保存！', !r.errno);
    }).catch(function(){ toast('保存失败', false); });
  });

  // Test LLM
  document.getElementById('test-btn').addEventListener('click', function() {
    var ep = document.getElementById('set-llm-ep').value.trim();
    var key = document.getElementById('set-llm-key').value.trim();
    var model = document.getElementById('set-llm-model').value.trim();
    if (!ep || !key) { toast('请先填写 Endpoint 和 Key', false); return; }
    fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: model || 'gpt-4o-mini', messages: [{ role: 'user', content: 'Hello, respond with OK' }], max_tokens: 10 }) })
    .then(function(r) { toast(r.ok ? 'LLM 连接正常！' : '失败: ' + r.status, r.ok); })
    .catch(function(e) { toast('错误: ' + e.message, false); });
  });
})();
</script>
</body>
</html>`;
}
