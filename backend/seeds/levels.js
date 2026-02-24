const PYTHON_MODULES = [
  {
  name: 'Variavel',
  topics: [
  { title: 'Boas-vindas do sistema', template: 'py_msg_initial' },
  { title: 'int() para inteiros', template: 'py_cadastro' },
  { title: 'float() para decimais', template: 'py_media' },
  { title: 'Strings em Python', template: 'py_login_simples' },
  { title: 'Booleanos em Python', template: 'py_resultado_escolar' }
  ]
  },
  {
  name: 'Entrada com contexto',
  topics: [
  { title: 'input() em Python', template: 'py_cadastro' },
  { title: 'input() + int()', template: 'py_input_adivinho' },
  { title: 'input() + float()', template: 'py_input_promocao' },
  { title: 'Booleano basico', template: 'py_input_cadastro_final' }
  ]
  },
  {
  name: 'Decisoes e Validacoes',
  topics: [
  { title: 'if / else em Python', template: 'py_acesso_idade' },
  { title: 'if / elif / else', template: 'py_classificacao_etaria' }
  ]
  },
  {
  name: 'Operadores',
  topics: [
  { title: 'Operadores de comparacao', template: 'py_maior' },
  { title: 'Operadores logicos', template: 'py_desconto' },
  { title: 'Operadores aritmeticos', template: 'py_soma_gastos' },
  { title: 'Expressoes compostas', template: 'py_desconto_progressivo' }
  ]
  },
  {
  name: 'Lacos',
  topics: [
  { title: 'while em Python', template: 'py_app_login_tentativas' },
  { title: 'while com input()', template: 'py_app_fila' },
  { title: 'break e continue', template: 'py_app_pilha' }
  ]
  },
  {
  name: 'Lacos for',
  topics: [
  { title: 'for em Python', template: 'py_app_boletim' },
  { title: 'for com input()', template: 'py_app_vendas_mensais' },
  { title: 'for com listas', template: 'py_app_boletim' },
  { title: 'for com range()', template: 'py_app_fila' },
  { title: 'for com indices', template: 'py_app_pilha' },
  { title: 'range(inicio, fim)', template: 'py_app_login_tentativas' },
  { title: 'for com indices (reforco)', template: 'py_app_login_tentativas' }
  ]
  },
  {
  name: 'Listas',
  topics: [
  { title: 'Listas em Python', template: 'py_app_formulario' }
  ]
  }
  ];


const JAVA_MODULES = [
{
name: 'Fundamentos de Java',
topics: [
{ title: 'Boas-vindas do sistema', template: 'java_msg_initial' },
{ title: 'Cadastro de usuario', template: 'java_cadastro' },
{ title: 'Controle de estoque (somar remessas)', template: 'java_estoque' },
{ title: 'Media de desempenho (duas notas)', template: 'java_media' },
{ title: 'Horas extras (dobrar salario)', template: 'java_salario' },
{ title: 'Area de terreno (retangulo)', template: 'java_area' }
]
},
{
name: 'Condicionais e Lacos',
topics: [
{ title: 'Conversao de temperatura (C -> F)', template: 'java_temp' },
{ title: 'Comparacao de dois valores (maior)', template: 'java_maior' },
{ title: 'Desconto simples (10%)', template: 'java_desconto' },
{ title: 'Soma de gastos diarios', template: 'java_soma_gastos' },
{ title: 'Fatorial com loop', template: 'factorial' },
{ title: 'Tabuada do numero', template: 'multiplication_table' },
{ title: 'Quantidade de digitos', template: 'count_digits' },
{ title: 'Sequencia FizzBuzz', template: 'fizzbuzz' },
{ title: 'Contagem em intervalo', template: 'range_count' },
{ title: 'Soma de lista simples', template: 'list_sum' }
]
},
{
name: 'Lacos e Sequencias',
topics: [
{ title: 'Contagem sequencial', template: 'java_contagem_1_10' },
{ title: 'Soma acumulada', template: 'java_soma_1_100' },
{ title: 'Tabuada automatica', template: 'java_tabuada' },
{ title: 'Contador de numeros pares', template: 'java_conta_pares' },
{ title: 'Fatorial simples', template: 'java_fatorial' },
{ title: 'Leitura repetida ate 0', template: 'java_soma_ate_zero' },
{ title: 'Media de varios valores', template: 'java_media_ate_zero' },
{ title: 'Maior valor da sequencia', template: 'java_maior_ate_zero' },
{ title: 'Contagem regressiva', template: 'java_contagem_regressiva' },
{ title: 'Menu simples em loop', template: 'java_menu_loop' }
]
},
{
name: 'Arrays e Metodos',
topics: [
{ title: 'Soma de valores em um array', template: 'java_array_soma' },
{ title: 'Maior valor de um array', template: 'java_array_maior' },
{ title: 'Contagem de pares em um array', template: 'java_array_pares' },
{ title: 'Metodo de saudacao personalizada', template: 'java_metodo_saudacao' },
{ title: 'Metodo para calculo de media', template: 'java_metodo_media' },
{ title: 'Metodo para verificar numero primo', template: 'java_metodo_primo' },
{ title: 'Inversao de array', template: 'java_array_inversao' },
{ title: 'Contagem de ocorrencias de um valor', template: 'java_array_ocorrencias' },
{ title: 'Metodo para validacao de senha', template: 'java_validar_senha' },
{ title: 'Metodo de resumo estatistico', template: 'java_resumo_estatistico' }
]
},
{
name: 'Algoritmos e Arrays',
topics: [
{ title: 'Ordenacao simples (Bubble Sort)', template: 'java_bubble_sort' },
{ title: 'Busca linear em array', template: 'java_busca_linear' },
{ title: 'Busca binaria', template: 'java_busca_binaria' },
{ title: 'Remocao de elemento por indice', template: 'java_remove_indice' },
{ title: 'Eliminacao de duplicatas', template: 'java_remove_duplicados' },
{ title: 'Verificacao de array ordenado', template: 'java_array_ordenado' },
{ title: 'Rotacao de array', template: 'java_rotacao_array' },
{ title: 'Intersecao de dois arrays', template: 'java_intersecao_arrays' },
{ title: 'Subarray com maior soma', template: 'java_subarray_max' },
{ title: 'Consolidador algoritmico', template: 'java_consolidador' }
]
},
{
name: 'Sistemas Aplicados',
topics: [
{ title: 'Validacao de formulario', template: 'java_validar_formulario' },
{ title: 'Login com tentativas limitadas', template: 'java_login_tentativas' },
{ title: 'Fila de atendimento (FIFO)', template: 'java_fila_atendimento' },
{ title: 'Pilha de desfazer (LIFO)', template: 'java_pilha_desfazer' },
{ title: 'Analise de vendas mensais', template: 'java_vendas_mensais' },
{ title: 'Boletim escolar automatico', template: 'java_boletim' },
{ title: 'Classificacao por pontuacao', template: 'java_classificacao_pontos' },
{ title: 'Deteccao de repeticao consecutiva', template: 'java_padroes_consecutivos' },
{ title: 'Relatorio consolidado', template: 'java_relatorio_consolidado' },
{ title: 'Mini-sistema administrativo', template: 'java_mini_sistema' }
]
},
{
name: 'Performance e Estruturas',
topics: [
{ title: 'Pensando em performance', template: 'java_perf_analise' },
{ title: 'Ordenacao eficiente', template: 'java_perf_algoritmos' },
{ title: 'Busca eficiente em dados grandes', template: 'java_perf_busca' },
{ title: 'Eliminacao eficiente de duplicatas', template: 'java_perf_duplicatas' },
{ title: 'Agrupamento e consolidacao de dados', template: 'java_perf_agrupamento' }
]
},
{
name: 'Sistemas Reais Avancados',
topics: [
{ title: 'Sistema bancario com regras', template: 'java_banco_regras' },
{ title: 'Controle de estoque com alertas', template: 'java_estoque_alerta' },
{ title: 'Relatorio financeiro avancado', template: 'java_relatorio_financeiro' },
{ title: 'Sistema de votacao com empate', template: 'java_votacao_empate' },
{ title: 'Autenticacao e estado do sistema', template: 'java_autenticacao_estado' }
]
},
{
name: 'Capstone Java',
topics: [
{ title: 'Agenda de contatos (CRUD)', template: 'java_cap_agenda' },
{ title: 'Cadastro de clientes', template: 'java_cap_clientes' },
{ title: 'Analisador de texto', template: 'java_cap_texto' },
{ title: 'Fila de atendimento com prioridade', template: 'java_cap_fila_prioridade' },
{ title: 'Sistema de pedidos', template: 'java_cap_pedidos' },
{ title: 'Controle de usuarios (CRUD)', template: 'java_cap_usuarios' },
{ title: 'Simulador de jogo simples', template: 'java_cap_jogo' },
{ title: 'Analise de logs do sistema', template: 'java_cap_logs' },
{ title: 'Sistema de ranking', template: 'java_cap_ranking' },
{ title: 'Consolidador multi-modulo', template: 'java_cap_consolidador' }
]
},
{
name: 'Projeto Final Java',
topics: [
{ title: 'Controle financeiro pessoal', template: 'java_proj_financeiro' },
{ title: 'Gestao escolar integrada', template: 'java_proj_escolar' },
{ title: 'Sistema de estoque completo', template: 'java_proj_estoque' },
{ title: 'Analise textual avancada', template: 'java_proj_texto' },
{ title: 'Cadastro de clientes com persistencia', template: 'java_proj_clientes' },
{ title: 'Relatorio integrado multi-modulo', template: 'java_proj_relatorio' },
{ title: 'Controle de permissoes', template: 'java_proj_permissoes' },
{ title: 'Analise de desempenho do sistema', template: 'java_proj_desempenho' },
{ title: 'Sistema integrado com auditoria', template: 'java_proj_auditoria' },
{ title: 'Projeto final absoluto', template: 'java_proj_final' }
]
},
{
name: 'Profissionalizacao Java',
topics: [
{ title: 'Refatoracao orientada a responsabilidade (SRP)', template: 'java_srp_refactor' },
{ title: 'Tratamento de erros profissional', template: 'java_exceptions' },
{ title: 'Persistencia estruturada (DAO)', template: 'java_dao' },
{ title: 'Logs profissionais com niveis', template: 'java_logs_niveis' },
{ title: 'Configuracao externa do sistema', template: 'java_config_externa' },
{ title: 'Testes basicos automatizados', template: 'java_testes_basicos' },
{ title: 'Documentacao tecnica minima', template: 'java_documentacao' },
{ title: 'Preparacao para API', template: 'java_preparacao_api' },
{ title: 'Seguranca logica basica', template: 'java_seg_logica' },
{ title: 'Projeto de transicao para mercado', template: 'java_transicao_mercado' }
]
},
{
name: 'Arrays e Colecoes',
topics: [
{ title: 'Soma de lista', template: 'list_sum' },
{ title: 'Menor e maior', template: 'list_min_max' },
{ title: 'Ordenacao de numeros', template: 'sort_numbers' },
{ title: 'Caracteres unicos', template: 'unique_count' },
{ title: 'Contar palavras', template: 'count_words' },
{ title: 'Frequencia de caractere', template: 'char_frequency' }
]
},
{
name: 'Metodos',
topics: [
{ title: 'Somar com metodo', template: 'sum_two' },
{ title: 'Inverter string', template: 'reverse_string' },
{ title: 'Palindromo', template: 'palindrome' },
{ title: 'Contar vogais', template: 'count_vowels' },
{ title: 'Maior de dois valores', template: 'max_two' },
{ title: 'Menor e maior', template: 'list_min_max' }
]
},
{
name: 'Strings e Excecoes',
topics: [
{ title: 'Inverter string', template: 'reverse_string' },
{ title: 'Contar palavras', template: 'count_words' },
{ title: 'Frequencia de caractere', template: 'char_frequency' },
{ title: 'Palindromo', template: 'palindrome' },
{ title: 'Caracteres unicos', template: 'unique_count' },
{ title: 'Contar vogais', template: 'count_vowels' }
]
},
{
name: 'Orientacao a Objetos',
topics: [
{ title: 'Soma de dois numeros', template: 'sum_two' },
{ title: 'Maior de dois valores', template: 'max_two' },
{ title: 'Soma de lista', template: 'list_sum' },
{ title: 'Menor e maior', template: 'list_min_max' },
{ title: 'Ordenar numeros', template: 'sort_numbers' },
{ title: 'Soma de matriz 2x2', template: 'matrix_sum' }
]
},
{
name: 'Pacotes e Bibliotecas',
topics: [
{ title: 'Somatorio de 1 ate N', template: 'sum_1_n' },
{ title: 'Par ou impar', template: 'even_odd' },
{ title: 'Quantidade de digitos', template: 'count_digits' },
{ title: 'Soma de lista', template: 'list_sum' },
{ title: 'Ordenacao de numeros', template: 'sort_numbers' },
{ title: 'Contar palavras', template: 'count_words' }
]
},
{
name: 'Algoritmos',
topics: [
{ title: 'Ordenacao de numeros', template: 'sort_numbers' },
{ title: 'Menor e maior', template: 'list_min_max' },
{ title: 'Contar vogais', template: 'count_vowels' },
{ title: 'Caracteres unicos', template: 'unique_count' },
{ title: 'Sequencia FizzBuzz', template: 'fizzbuzz' },
{ title: 'Contagem em intervalo', template: 'range_count' }
]
},
{
name: 'Topicos Avancados',
topics: [
{ title: 'Palindromo', template: 'palindrome' },
{ title: 'Frequencia de caractere', template: 'char_frequency' },
{ title: 'Contar palavras', template: 'count_words' },
{ title: 'Inverter string', template: 'reverse_string' },
{ title: 'Soma de lista', template: 'list_sum' },
{ title: 'Ordenacao de numeros', template: 'sort_numbers' }
]
},
{
name: 'Projetos',
topics: [
{ title: 'Tabuada', template: 'multiplication_table' },
{ title: 'Fatorial', template: 'factorial' },
{ title: 'Soma de matriz 2x2', template: 'matrix_sum' },
{ title: 'Menor e maior', template: 'list_min_max' },
{ title: 'Contar vogais', template: 'count_vowels' },
{ title: 'Palindromo', template: 'palindrome' }
]
}
];

const REDE_MODULE_NAMES = [
'Fundamentos de Redes',
'Modelo OSI e TCP/IP',
'Enderecamento IP',
'Subnetting e CIDR',
'Switching e VLANs',
'Routing Basico',
'Protocolos de Transporte',
'Servicos de Rede',
'Seguranca e Firewalls',
'Monitoramento e Ferramentas'
];

const REDE_MODULES = REDE_MODULE_NAMES.map((name) => ({
  name,
  topics: Array.from({ length: 6 }, (_item, index) => ({
  title: `${name} - Topico ${index + 1}`,
  template: 'rede_generic'
  }))
  }));

REDE_MODULES.push({
  name: 'Engenharia Reversa',
  topics: [
  { title: 'Engenharia reversa - conceitos e limites', template: 'rede_rev_intro' },
  { title: 'Engenharia reversa - fluxo seguro', template: 'rede_rev_fluxo' },
  { title: 'Engenharia reversa - analise estatica', template: 'rede_rev_estatica' },
  { title: 'Engenharia reversa - analise dinamica', template: 'rede_rev_dinamica' },
  { title: 'Engenharia reversa - desassemblagem', template: 'rede_rev_disassembly' },
  { title: 'Engenharia reversa - debugging', template: 'rede_rev_debug' },
  { title: 'Engenharia reversa - formatos de arquivo', template: 'rede_rev_formatos' },
  { title: 'Engenharia reversa - ofuscacao e packers', template: 'rede_rev_ofuscacao' },
  { title: 'Engenharia reversa - protocolos', template: 'rede_rev_protocolos' },
  { title: 'Engenharia reversa - relatorio tecnico', template: 'rede_rev_relatorio' }
  ]
});

REDE_MODULES.push({
  name: 'Rede Aplicada I',
  topics: [
  { title: 'Rede 71 - Tempo de transmissao', template: 'rede_071_transmissao' },
  { title: 'Rede 72 - IP privado ou publico', template: 'rede_072_ip_privado' },
  { title: 'Rede 73 - Resolucao DNS', template: 'rede_073_dns_lookup' },
  { title: 'Rede 74 - Porta e servico', template: 'rede_074_porta_servico' },
  { title: 'Rede 75 - Perda de pacotes', template: 'rede_075_perda_pacotes' }
  ]
});

REDE_MODULES.push({
  name: 'Rede Aplicada II',
  topics: [
  { title: 'Rede 76 - Camada OSI', template: 'rede_076_osi_camada' },
  { title: 'Rede 77 - Status HTTP', template: 'rede_077_http_status' },
  { title: 'Rede 78 - Hosts em sub-rede', template: 'rede_078_cidr_hosts' },
  { title: 'Rede 79 - MAC duplicado', template: 'rede_079_mac_duplicado' },
  { title: 'Rede 80 - Mesma sub-rede', template: 'rede_080_mesma_subrede' }
  ]
});

REDE_MODULES.push({
  name: 'Rede Aplicada III',
  topics: [
  { title: 'Rede 81 - Traceroute', template: 'rede_081_traceroute' },
  { title: 'Rede 82 - DHCP', template: 'rede_082_dhcp' },
  { title: 'Rede 83 - NAT e porta externa', template: 'rede_083_nat_porta' },
  { title: 'Rede 84 - HTTPS seguro', template: 'rede_084_https' },
  { title: 'Rede 85 - Firewall allowlist', template: 'rede_085_firewall' }
  ]
});

REDE_MODULES.push({
  name: 'Rede Aplicada IV',
  topics: [
  { title: 'Rede 86 - Contagem de logs', template: 'rede_086_logs_contagem' },
  { title: 'Rede 87 - ARP lookup', template: 'rede_087_arp_lookup' },
  { title: 'Rede 88 - Longest prefix match', template: 'rede_088_lpm' },
  { title: 'Rede 89 - Jitter', template: 'rede_089_jitter' },
  { title: 'Rede 90 - Metodo idempotente', template: 'rede_090_http_idempotente' }
  ]
});

REDE_MODULES.push({
  name: 'Rede Aplicada V',
  topics: [
  { title: 'Rede 91 - Port scan', template: 'rede_091_portscan' },
  { title: 'Rede 92 - Fragmentacao MTU', template: 'rede_092_mtu_fragmentacao' },
  { title: 'Rede 93 - TTL de DNS', template: 'rede_093_dns_ttl' },
  { title: 'Rede 94 - Roteamento via VPN', template: 'rede_094_vpn_rota' },
  { title: 'Rede 95 - Severidade de incidente', template: 'rede_095_incidente' }
  ]
});

function buildLevelsForLanguage(language, modules, languageIds) {
const levels = [];
let orderIndex = 1;
let seed = 0;
modules.forEach((module, moduleIndex) => {
module.topics.forEach((topic, topicIndex) => {
levels.push(
buildLevel(
language,
module.name,
moduleIndex + 1,
topicIndex === 0,
orderIndex,
topic.title,
topic.template,
seed,
languageIds
)
);
orderIndex += 1;
seed += 1;
});
});
return levels;
}

function buildLevels(languageIds = DEFAULT_LANGUAGE_IDS) {
return [
...buildLevelsForLanguage('Python', PYTHON_MODULES, languageIds),
...buildLevelsForLanguage('Java', JAVA_MODULES, languageIds),
...buildLevelsForLanguage('Rede', REDE_MODULES, languageIds)
];
}

module.exports = { buildLevels };
