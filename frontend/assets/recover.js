import { api } from './app.js';

const form = document.getElementById('recoverForm');
const message = document.getElementById('recoverMessage');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.style.display = 'none';
  const formData = new FormData(form);
  const email = formData.get('email');

  try {
    const data = await api.recover({ email });
    message.textContent = data.message;
    message.className = 'notice success';
    message.style.display = 'block';
  } catch (err) {
    message.textContent = err.message;
    message.className = 'notice error';
    message.style.display = 'block';
  }
});
