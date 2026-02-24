import { api, setToken } from './app.js';

const form = document.getElementById('registerForm');
const errorBox = document.getElementById('registerError');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.style.display = 'none';

  const formData = new FormData(form);
  const username = formData.get('username');
  const email = formData.get('email');
  const password = formData.get('password');
  const classCode = formData.get('classCode');
  const role = formData.get('role');

  try {
    const payload = { username, email, password };
    if (classCode) {
      payload.classCode = classCode;
    }
    if (role) {
      payload.role = role;
    }
    const data = await api.register(payload);
    setToken(data.token);
    window.location.href = '/choose-language';
  } catch (err) {
    errorBox.textContent = err.message;
    errorBox.style.display = 'block';
  }
});

