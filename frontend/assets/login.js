import { api, setToken } from './app.js';

const form = document.getElementById('loginForm');
const errorBox = document.getElementById('loginError');
const introOverlay = document.getElementById('introOverlay');
const introVideo = document.getElementById('introVideo');

function redirectAfterLogin(user) {
  const primary = user.primary_language_id;
  if (primary) {
    window.location.href = `/map/${primary}`;
  } else {
    window.location.href = '/choose-language';
  }
}

async function showIntro(user) {
  if (!introOverlay || !introVideo) {
    redirectAfterLogin(user);
    return;
  }

  introOverlay.classList.remove('is-hidden');
  introOverlay.setAttribute('aria-hidden', 'false');
  const finish = async () => {
    try {
      await api.markIntroSeen();
    } catch (err) {
      // ignore
    }
    redirectAfterLogin(user);
  };

  introVideo.currentTime = 0;
  introVideo.play().catch(() => {
    introOverlay.addEventListener(
      'click',
      () => {
        finish();
      },
      { once: true }
    );
  });
  introVideo.addEventListener(
    'ended',
    () => {
      finish();
    },
    { once: true }
  );
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.style.display = 'none';

  const formData = new FormData(form);
  const identifier = formData.get('identifier');
  const password = formData.get('password');

  try {
    const data = await api.login({ identifier, password });
    setToken(data.token);
    if (data.user.intro_seen) {
      redirectAfterLogin(data.user);
    } else {
      showIntro(data.user);
    }
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.style.display = 'block';
  }
});

