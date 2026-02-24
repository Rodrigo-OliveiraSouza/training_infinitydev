import { api, requireAuth, attachLogout } from './app.js';

const container = document.getElementById('languageOptions');

async function init() {
  const user = await requireAuth();
  if (!user) return;

  let data;
  try {
    data = await api.languages();
  } catch (err) {
    container.innerHTML = `<p class="notice error">Falha ao carregar linguagens. Verifique o servidor.</p>`;
    return;
  }
  container.innerHTML = '';

  const descriptions = {
    Python: 'Trilha focada em fundamentos, algoritmos e Python moderno.',
    Java: 'Trilha focada em fundamentos, POO e Java para mercado.',
    Rede: 'Trilha focada em redes, protocolos e infraestrutura.'
  };

  const order = ['Python', 'Java', 'Rede'];
  const languages = (data.languages || [])
    .slice()
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  if (!languages.length) {
    container.innerHTML =
      '<p class="notice">Nenhuma linguagem encontrada. Rode o seed para criar as trilhas.</p>';
    return;
  }

  languages.forEach((language) => {
    const card = document.createElement('div');
    card.className = 'card';
    const description = descriptions[language.name] || 'Trilha com 60 fases do basico ao avancado.';
    card.innerHTML = `
      <h3>${language.name}</h3>
      <p class="notice">${description}</p>
      <button class="button" data-id="${language.id}">Selecionar</button>
    `;
    card.querySelector('button').addEventListener('click', async () => {
      await api.setLanguage(language.id);
      window.location.href = `/map/${language.id}`;
    });
    container.appendChild(card);
  });
}

attachLogout();
init();

