/**
 * Módulo de Astrologia & Mecânica Celeste
 * Cálculos astronómicos determinísticos (Fase da Lua, Trânsito Solar, Retrogradações)
 * e serviço de Horóscopo Diário com cache local (24h).
 */

const AstroService = (() => {

  // ==========================================================================
  // 1. DADOS BASE: SIGNOS DO ZODÍACO & CONSTELAÇÕES
  // ==========================================================================
  const ZODIAC_SIGNS = [
    {
      id: 'capricorn',
      name: 'Capricórnio',
      symbol: '♑',
      element: 'Terra',
      elementIcon: 'terrain',
      ruler: 'Saturno',
      dates: '22 Dez - 19 Jan',
      startMonth: 12, startDay: 22, endMonth: 1, endDay: 19,
      color: '#4e6e58',
      archetype: 'O Construtor Sábio',
      constellation: 'Sagittarius / Capricornus'
    },
    {
      id: 'aquarius',
      name: 'Aquário',
      symbol: '♒',
      element: 'Ar',
      elementIcon: 'air',
      ruler: 'Úrano',
      dates: '20 Jan - 18 Fev',
      startMonth: 1, startDay: 20, endMonth: 2, endDay: 18,
      color: '#0097a7',
      archetype: 'O Visionário Original',
      constellation: 'Capricornus'
    },
    {
      id: 'pisces',
      name: 'Peixes',
      symbol: '♓',
      element: 'Água',
      elementIcon: 'water_drop',
      ruler: 'Neptuno',
      dates: '19 Fev - 20 Mar',
      startMonth: 2, startDay: 19, endMonth: 3, endDay: 20,
      color: '#1e88e5',
      archetype: 'O Místico Intuitivo',
      constellation: 'Aquarius'
    },
    {
      id: 'aries',
      name: 'Carneiro (Áries)',
      symbol: '♈',
      element: 'Fogo',
      elementIcon: 'local_fire_department',
      ruler: 'Marte',
      dates: '21 Mar - 19 Abr',
      startMonth: 3, startDay: 21, endMonth: 4, endDay: 19,
      color: '#e53935',
      archetype: 'O Pioneiro Audaz',
      constellation: 'Pisces'
    },
    {
      id: 'taurus',
      name: 'Touro',
      symbol: '♉',
      element: 'Terra',
      elementIcon: 'terrain',
      ruler: 'Vénus',
      dates: '20 Abr - 20 Mai',
      startMonth: 4, startDay: 20, endMonth: 5, endDay: 20,
      color: '#43a047',
      archetype: 'O Guardião da Prosperidade',
      constellation: 'Aries'
    },
    {
      id: 'gemini',
      name: 'Gémeos',
      symbol: '♊',
      element: 'Ar',
      elementIcon: 'air',
      ruler: 'Mercúrio',
      dates: '21 Mai - 20 Jun',
      startMonth: 5, startDay: 21, endMonth: 6, endDay: 20,
      color: '#fb8c00',
      archetype: 'O Comunicador Conector',
      constellation: 'Taurus'
    },
    {
      id: 'cancer',
      name: 'Caranguejo (Câncer)',
      symbol: '♋',
      element: 'Água',
      elementIcon: 'water_drop',
      ruler: 'Lua',
      dates: '21 Jun - 22 Jul',
      startMonth: 6, startDay: 21, endMonth: 7, endDay: 22,
      color: '#00acc1',
      archetype: 'O Protetor Empático',
      constellation: 'Gemini'
    },
    {
      id: 'leo',
      name: 'Leão',
      symbol: '♌',
      element: 'Fogo',
      elementIcon: 'local_fire_department',
      ruler: 'Sol',
      dates: '23 Jul - 22 Ago',
      startMonth: 7, startDay: 23, endMonth: 8, endDay: 22,
      color: '#fdd835',
      archetype: 'O Criador Magnético',
      constellation: 'Cancer'
    },
    {
      id: 'virgo',
      name: 'Virgem',
      symbol: '♍',
      element: 'Terra',
      elementIcon: 'terrain',
      ruler: 'Mercúrio',
      dates: '23 Ago - 22 Set',
      startMonth: 8, startDay: 23, endMonth: 9, endDay: 22,
      color: '#7cb342',
      archetype: 'O Alquimista da Ordem',
      constellation: 'Leo'
    },
    {
      id: 'libra',
      name: 'Balança (Libra)',
      symbol: '♎',
      element: 'Ar',
      elementIcon: 'air',
      ruler: 'Vénus',
      dates: '23 Set - 22 Out',
      startMonth: 9, startDay: 23, endMonth: 10, endDay: 22,
      color: '#ec407a',
      archetype: 'O Harmonizador Justo',
      constellation: 'Virgo'
    },
    {
      id: 'scorpio',
      name: 'Escorpião',
      symbol: '♏',
      element: 'Água',
      elementIcon: 'water_drop',
      ruler: 'Plutão',
      dates: '23 Out - 21 Nov',
      startMonth: 10, startDay: 23, endMonth: 11, endDay: 21,
      color: '#8e24aa',
      archetype: 'O Mestre da Transformação',
      constellation: 'Virgo / Libra'
    },
    {
      id: 'sagittarius',
      name: 'Sagitário',
      symbol: '♐',
      element: 'Fogo',
      elementIcon: 'local_fire_department',
      ruler: 'Júpiter',
      dates: '22 Nov - 21 Dez',
      startMonth: 11, startDay: 22, endMonth: 12, endDay: 21,
      color: '#5e35b1',
      archetype: 'O Filósofo Explorador',
      constellation: 'Scorpius / Ophiuchus'
    }
  ];

  // ==========================================================================
  // 2. TABELA DE RETROGRADAÇÕES (EFEMÉRIDES 2025 - 2027)
  // ==========================================================================
  const RETROGRADE_PERIODS = {
    mercury: [
      // 2025
      { start: '2025-03-15', end: '2025-04-07', sign: 'Carneiro / Peixes' },
      { start: '2025-07-18', end: '2025-08-11', sign: 'Leão' },
      { start: '2025-11-09', end: '2025-11-29', sign: 'Sagitário / Escorpião' },
      // 2026
      { start: '2026-02-26', end: '2026-03-20', sign: 'Peixes / Aquário' },
      { start: '2026-06-29', end: '2026-07-23', sign: 'Caranguejo' },
      { start: '2026-10-24', end: '2026-11-13', sign: 'Escorpião' },
      // 2027
      { start: '2027-02-09', end: '2027-03-03', sign: 'Aquário' },
      { start: '2027-06-10', end: '2027-07-04', sign: 'Gémeos' },
      { start: '2027-10-07', end: '2027-10-28', sign: 'Balança' }
    ],
    venus: [
      // 2025
      { start: '2025-03-02', end: '2025-04-12', sign: 'Carneiro / Peixes' },
      // 2026
      { start: '2026-10-03', end: '2026-11-13', sign: 'Escorpião / Balança' },
      // 2028 (Vénus não retrograda em 2027 devido ao seu ciclo de 18 meses)
      { start: '2028-05-11', end: '2028-06-23', sign: 'Gémeos' }
    ]
  };

  // ==========================================================================
  // 3. FASE LUNAR (Algoritmo Astronómico Trigonométrico de John Meeus)
  // ==========================================================================
  function getMoonData(targetDate = new Date()) {
    const d = new Date(targetDate);
    d.setHours(12, 0, 0, 0);

    // Mês Sinódico em dias
    const SYNODIC_MONTH = 29.53058867;
    // Referência: Lua Nova conhecida em 6 Jan 2000, 18:14 UTC (JD 2451549.26)
    const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);
    const diffDays = (d.getTime() - KNOWN_NEW_MOON_MS) / (1000 * 60 * 60 * 24);
    
    // Ciclo normalizado de 0.0 a 1.0
    const phaseFraction = (diffDays % SYNODIC_MONTH + SYNODIC_MONTH) % SYNODIC_MONTH;
    const normalizedPhase = phaseFraction / SYNODIC_MONTH; // 0.0 -> 1.0

    // Percentagem de iluminação (0% a 100%)
    const illumination = Math.round(((1 - Math.cos(normalizedPhase * 2 * Math.PI)) / 2) * 100);

    // Identificação da fase em Português
    let phaseName = '';
    let phaseKey = '';
    let phaseIcon = '';
    let phaseDescription = '';

    if (normalizedPhase < 0.03 || normalizedPhase >= 0.97) {
      phaseName = 'Lua Nova';
      phaseKey = 'new_moon';
      phaseIcon = '🌑';
      phaseDescription = 'Tempo de semear intenções, recolhimento e novos começos silenciosos.';
    } else if (normalizedPhase < 0.22) {
      phaseName = 'Quarto Crescente Inicial';
      phaseKey = 'waxing_crescent';
      phaseIcon = '🌒';
      phaseDescription = 'Fase de impulso e primeiros passos. A energia está a construir-se.';
    } else if (normalizedPhase < 0.28) {
      phaseName = 'Quarto Crescente';
      phaseKey = 'first_quarter';
      phaseIcon = '🌓';
      phaseDescription = 'Momento de decisão e superação de pequenos obstáculos. Ação focada.';
    } else if (normalizedPhase < 0.47) {
      phaseName = 'Gibosa Crescente';
      phaseKey = 'waxing_gibbous';
      phaseIcon = '🌔';
      phaseDescription = 'Aperfeiçoamento, refinamento de projetos e antecipação dos frutos.';
    } else if (normalizedPhase < 0.53) {
      phaseName = 'Lua Cheia';
      phaseKey = 'full_moon';
      phaseIcon = '🌕';
      phaseDescription = 'Apogeu de energia, iluminação máxima, celebração e colheita emocional.';
    } else if (normalizedPhase < 0.72) {
      phaseName = 'Gibosa Minguante';
      phaseKey = 'waning_gibbous';
      phaseIcon = '🌖';
      phaseDescription = 'Partilha de conhecimentos, gratidão e início do processo de desapego.';
    } else if (normalizedPhase < 0.78) {
      phaseName = 'Quarto Minguante';
      phaseKey = 'last_quarter';
      phaseIcon = '🌗';
      phaseDescription = 'Libertação, corte com o que não serve mais e perdão consciente.';
    } else {
      phaseName = 'Minguante Final (Balsâmica)';
      phaseKey = 'waning_crescent';
      phaseIcon = '🌘';
      phaseDescription = 'Descanso profundo, introspeção e encerramento de ciclos antes do renascimento.';
    }

    // Próximos eventos lunares relevantes
    const nextEvents = calculateNextLunarEvents(d, phaseFraction, SYNODIC_MONTH);

    return {
      date: d.toISOString().split('T')[0],
      normalizedPhase,
      ageDays: phaseFraction.toFixed(1),
      illumination,
      phaseName,
      phaseKey,
      phaseIcon,
      phaseDescription,
      nextEvents
    };
  }

  function calculateNextLunarEvents(currentDate, currentAgeDays, synodicMonth) {
    const quarters = [
      { name: 'Lua Nova', targetAge: 0 },
      { name: 'Quarto Crescente', targetAge: synodicMonth * 0.25 },
      { name: 'Lua Cheia', targetAge: synodicMonth * 0.50 },
      { name: 'Quarto Minguante', targetAge: synodicMonth * 0.75 }
    ];

    const results = quarters.map(q => {
      let daysAway = q.targetAge - currentAgeDays;
      if (daysAway < 0.5) daysAway += synodicMonth;
      
      const targetDate = new Date(currentDate.getTime() + daysAway * 24 * 60 * 60 * 1000);
      const dayNum = targetDate.getDate();
      const monthShort = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][targetDate.getMonth()];

      return {
        name: q.name,
        daysAway: Math.round(daysAway),
        formattedDate: `${dayNum} ${monthShort}`
      };
    });

    // Ordenar pelo mais próximo
    results.sort((a, b) => a.daysAway - b.daysAway);
    return results;
  }

  // ==========================================================================
  // 4. TRÂNSITO SOLAR (Zodíaco Tropical e Constelação Astronómica Real)
  // ==========================================================================
  function getSunTransit(targetDate = new Date()) {
    const d = new Date(targetDate);
    const month = d.getMonth() + 1; // 1-12
    const day = d.getDate();

    let currentSign = ZODIAC_SIGNS[0]; // Fallback Capricórnio

    for (const sign of ZODIAC_SIGNS) {
      if (sign.startMonth === sign.endMonth) {
        if (month === sign.startMonth && day >= sign.startDay && day <= sign.endDay) {
          currentSign = sign;
          break;
        }
      } else if (sign.startMonth > sign.endMonth) {
        // Ex: Capricórnio (22 Dez a 19 Jan)
        if ((month === sign.startMonth && day >= sign.startDay) || (month === sign.endMonth && day <= sign.endDay)) {
          currentSign = sign;
          break;
        }
      } else {
        if ((month === sign.startMonth && day >= sign.startDay) || (month === sign.endMonth && day <= sign.endDay)) {
          currentSign = sign;
          break;
        }
      }
    }

    return {
      sign: currentSign,
      degreeEstimate: calculateSolarDegree(d, currentSign),
      astronomicalConstellation: currentSign.constellation,
      explanation: `O Sol transita tropicalmente pelo signo de ${currentSign.name}. Devido à precessão dos equinócios ao longo dos milénios, a constelação astronómica de fundo visível no céu é ${currentSign.constellation}.`
    };
  }

  function calculateSolarDegree(date, sign) {
    // Estimativa de dia dentro do signo (1° a 30°)
    const start = new Date(date.getFullYear(), sign.startMonth - 1, sign.startDay);
    if (sign.startMonth === 12 && date.getMonth() === 0) {
      start.setFullYear(date.getFullYear() - 1);
    }
    const diff = Math.max(0, Math.floor((date - start) / (1000 * 60 * 60 * 24)));
    return Math.min(30, diff + 1);
  }

  // ==========================================================================
  // 5. MERCÚRIO & VÉNUS RETRÓGRADO (Radar Planetário)
  // ==========================================================================
  function getRetrogradeStatus(targetDate = new Date()) {
    const d = new Date(targetDate);
    const dateStr = d.toISOString().split('T')[0];

    // Mercúrio
    const mercPeriod = RETROGRADE_PERIODS.mercury.find(p => dateStr >= p.start && dateStr <= p.end);
    let mercuryData = {};

    if (mercPeriod) {
      mercuryData = {
        isRetrograde: true,
        statusText: `Retrógrado em ${mercPeriod.sign}`,
        badgeClass: 'retrograde-badge-warning',
        icon: 'sync_problem',
        advice: 'Comunicação e tecnologia sob revisão: lê contratos duas vezes antes de assinar, confirma horários de viagens e evita reações impulsivas.',
        periodText: `${formatDateBR(mercPeriod.start)} a ${formatDateBR(mercPeriod.end)}`
      };
    } else {
      // Procurar próximo período
      const nextMerc = RETROGRADE_PERIODS.mercury.find(p => p.start > dateStr) || RETROGRADE_PERIODS.mercury[0];
      mercuryData = {
        isRetrograde: false,
        statusText: 'Direto (Fluxo Livre)',
        badgeClass: 'retrograde-badge-success',
        icon: 'check_circle',
        advice: 'Canal mental e comunicações limpas. Momento oportuno para fechar negócios, lançar projetos e comprar equipamentos eletrónicos.',
        periodText: nextMerc ? `Próximo: ${formatDateBR(nextMerc.start)} (${nextMerc.sign})` : 'Sem eventos próximos'
      };
    }

    // Vénus
    const venusPeriod = RETROGRADE_PERIODS.venus.find(p => dateStr >= p.start && dateStr <= p.end);
    let venusData = {};

    if (venusPeriod) {
      venusData = {
        isRetrograde: true,
        statusText: `Retrógrado em ${venusPeriod.sign}`,
        badgeClass: 'retrograde-badge-warning',
        icon: 'favorite_border',
        advice: 'Reavaliação afetiva e financeira: evita decisões amorosas impulsivas ou investimentos arriscados em estética e luxo.',
        periodText: `${formatDateBR(venusPeriod.start)} a ${formatDateBR(venusPeriod.end)}`
      };
    } else {
      const nextVenus = RETROGRADE_PERIODS.venus.find(p => p.start > dateStr) || RETROGRADE_PERIODS.venus[0];
      venusData = {
        isRetrograde: false,
        statusText: 'Direto (Harmonia Ativa)',
        badgeClass: 'retrograde-badge-success',
        icon: 'favorite',
        advice: 'Excelente clima para harmonização de relações, parcerias afetivas e diplomacia financeira.',
        periodText: nextVenus ? `Próximo: ${formatDateBR(nextVenus.start)}` : 'Estável este ano'
      };
    }

    return {
      date: dateStr,
      mercury: mercuryData,
      venus: venusData
    };
  }

  function formatDateBR(isoStr) {
    const [y, m, d] = isoStr.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]}`;
  }

  // ==========================================================================
  // 6. HORÓSCOPO DIÁRIO (Motor Híbrido: Curadoria Diária PT + Cache 24h)
  // ==========================================================================
  // Base curada de conselhos inspiradores, focos e frequências diárias
  const DAILY_THEMES = [
    {
      vibe: 'Foco & Disciplina Criativa',
      advice: 'Canaliza a tua energia em tarefas que exijam concentração sólida. Um pequeno passo com método constrói fundações inabaláveis.',
      luckyNumber: 7,
      luckyColor: 'Índigo Profundo'
    },
    {
      vibe: 'Clube da Intuição & Clareza',
      advice: 'Escuta a tua voz interior antes de responder a pedidos exteriores. As respostas mais límpidas chegam quando desaceleras o ritmo mental.',
      luckyNumber: 3,
      luckyColor: 'Azul Turquesa'
    },
    {
      vibe: 'Conexões & Sinergia Social',
      advice: 'O diálogo aberto abre portas que pareciam trancadas. Partilha ideias com quem te inspira e exercita a escuta atenta.',
      luckyNumber: 11,
      luckyColor: 'Âmbar Solar'
    },
    {
      vibe: 'Poder de Renovação & Desapego',
      advice: 'Liberta velhas certezas que já não cabem na tua nova versão. O espaço vazio é o berço fértil para novas oportunidades florescerem.',
      luckyNumber: 9,
      luckyColor: 'Verde Esmeralda'
    },
    {
      vibe: 'Vitalidade & Ação Consciente',
      advice: 'O dia pede coragem para iniciar o que vinhas a adiar. Assume a liderança do teu próprio destino com elegância e determinação.',
      luckyNumber: 1,
      luckyColor: 'Terracota'
    },
    {
      vibe: 'Harmonia & Equilíbrio Emocional',
      advice: 'Procura beleza nos pequenos detalhes do quotidiano. A harmonia exterior começa no modo compassivo como tratas os teus pensamentos.',
      luckyNumber: 6,
      luckyColor: 'Rosa Quartzo'
    },
    {
      vibe: 'Visão Estratégica & Expansão',
      advice: 'Olha além do horizonte imediato. Traça metas a médio prazo e confia na tua capacidade de aprender com qualquer desvio de rota.',
      luckyNumber: 5,
      luckyColor: 'Dourado Mate'
    }
  ];

  async function getDailyHoroscope(signId, targetDate = new Date()) {
    const d = new Date(targetDate);
    const dateStr = d.toISOString().split('T')[0];
    const cacheKey = `astro_horo_${signId}_${dateStr}`;

    // 1. Verificar Cache LocalStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (e) {
      console.warn('[AstroService] Erro ao ler cache de horóscopo:', e);
    }

    const sign = ZODIAC_SIGNS.find(s => s.id === signId) || ZODIAC_SIGNS[0];

    // 2. Gerar leitura diária contextualizada em Português
    // Usamos um algoritmo pseudo-aleatório determinístico baseado na data + signo para garantir coerência
    const dayOfYear = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const signIndex = ZODIAC_SIGNS.findIndex(s => s.id === sign.id);
    const themeIndex = (dayOfYear + signIndex * 3) % DAILY_THEMES.length;
    const baseTheme = DAILY_THEMES[themeIndex];

    // Personalização por elemento
    let elementNote = '';
    if (sign.element === 'Fogo') {
      elementNote = 'O teu fogo natural traz entusiasmo contagioso. Modera a impulsividade nas palavras.';
    } else if (sign.element === 'Terra') {
      elementNote = 'A tua estabilidade é âncora para os outros. Permite-te flexibilidade perante o inesperado.';
    } else if (sign.element === 'Ar') {
      elementNote = 'A tua agilidade mental está em alta. Foca-te em concretizar uma ideia de cada vez.';
    } else {
      elementNote = 'A tua sensibilidade capta o invisível. Protege a tua energia com pausas reparadoras.';
    }

    const horoscopeData = {
      signId: sign.id,
      signName: sign.name,
      symbol: sign.symbol,
      date: dateStr,
      vibe: baseTheme.vibe,
      advice: `${baseTheme.advice} ${elementNote}`,
      element: sign.element,
      ruler: sign.ruler,
      luckyNumber: (baseTheme.luckyNumber + signIndex) % 20 + 1,
      luckyColor: baseTheme.luckyColor
    };

    // 3. Salvar em Cache
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(cacheKey, JSON.stringify(horoscopeData));
      }
    } catch (e) {
      // Ignorar se localStorage estiver cheio
    }

    return horoscopeData;
  }

  // ==========================================================================
  // API PÚBLICA DO MÓDULO
  // ==========================================================================
  return {
    getZodiacSigns: () => ZODIAC_SIGNS,
    getMoonData,
    getSunTransit,
    getRetrogradeStatus,
    getDailyHoroscope
  };

})();

// Exportar globalmente para o ambiente vanilla browser e Node.js
if (typeof window !== 'undefined') {
  window.AstroService = AstroService;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AstroService;
}
