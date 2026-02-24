import { api, getToken, setToken } from './api.js';

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdown(md) {
  if (!md) return '';
  const lines = md.split('\n');
  const result = [];
  let inList = false;
  let inCode = false;
  let codeLang = '';

  const closeList = () => {
    if (inList) {
      result.push('</ul>');
      inList = false;
    }
  };

  lines.forEach((rawLine) => {
    const line = rawLine.replace(/\r$/, '');
    if (line.startsWith('```')) {
      if (!inCode) {
        closeList();
        codeLang = line.replace('```', '').trim();
        const langAttr = codeLang ? ` class="lang-${escapeHtml(codeLang)}"` : '';
        result.push(`<pre><code${langAttr}>`);
        inCode = true;
      } else {
        result.push('</code></pre>');
        inCode = false;
        codeLang = '';
      }
      return;
    }

    if (inCode) {
      result.push(escapeHtml(line) + '\n');
      return;
    }

    if (line.startsWith('# ')) {
      closeList();
      result.push(`<h2>${escapeHtml(line.slice(2))}</h2>`);
      return;
    }

    if (line.startsWith('## ')) {
      closeList();
      result.push(`<h3>${escapeHtml(line.slice(3))}</h3>`);
      return;
    }

    if (line.startsWith('- ')) {
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      result.push(`<li>${escapeHtml(line.slice(2))}</li>`);
      return;
    }

    if (line.trim().length === 0) {
      closeList();
      return;
    }

    closeList();
    result.push(`<p>${escapeHtml(line)}</p>`);
  });

  if (inCode) {
    result.push('</code></pre>');
  }
  if (inList) {
    result.push('</ul>');
  }

  return result.join('');
}

function formatDuration(ms) {
  if (ms === null || ms === undefined) return '--';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

async function requireAuth() {
  if (!getToken()) {
    window.location.href = '/login';
    return null;
  }
  try {
    const data = await api.me();
    return data.user;
  } catch (err) {
    setToken(null);
    window.location.href = '/login';
    return null;
  }
}

function attachLogout(buttonId = 'logoutButton') {
  const button = document.getElementById(buttonId);
  if (!button) return;
  button.addEventListener('click', async () => {
    try {
      await api.logout();
    } catch (err) {
      // ignore
    }
    setToken(null);
    window.location.href = '/';
  });
}

export { api, setToken, getToken, requireAuth, renderMarkdown, formatDuration, attachLogout };

