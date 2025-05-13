import fetch from 'node-fetch';

// Константы API и токенов
const JUPITER_API_URL = 'https://quote-api.jup.ag/v6/quote';
const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Минимальный профит в процентах для выполнения арбитража
const MIN_PROFIT_PERCENT = 0.5;

// Интерфейс для маршрутной информации
interface MarketInfo {
  id?: string;
  label?: string;
  ammKey?: string;
  inputMint?: string;
  outputMint?: string;
  inAmount?: string;
  outAmount?: string;
  feeAmount?: string;
  feeMint?: string;
}

// Интерфейс для маршрута обмена
interface RoutePlan {
  swapInfo: MarketInfo;
  percent: number;
}

// Полный интерфейс ответа Jupiter API
interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: RoutePlan[];
  contextSlot: number;
  timeTaken: number;
  error?: string;
}

// Интерфейс для представления токена
interface TokenInfo {
  symbol: string;
  address: string;
  decimals: number;
}

// Доступные токены
const TOKENS = {
  SOL: {
    symbol: 'SOL',
    address: SOL,
    decimals: 9
  },
  USDC: {
    symbol: 'USDC',
    address: USDC,
    decimals: 6
  }
};

// Результат арбитражной возможности
interface ArbitrageOpportunity {
  startToken: TokenInfo;
  middleToken: TokenInfo;
  startAmount: number;
  startAmountNative: number;
  middleAmount: number;
  middleAmountNative: number;
  finalAmount: number;
  finalAmountNative: number;
  profitAmount: number;
  profitPercent: number;
  totalFees: number;
  firstQuote: JupiterQuoteResponse;
  secondQuote: JupiterQuoteResponse;
  timestamp: number;
}

/**
 * Получает котировку для обмена токенов через Jupiter API
 * @param inputMint Адрес входящего токена
 * @param outputMint Адрес исходящего токена
 * @param amount Сумма входящего токена в нативных единицах (с учетом decimals)
 * @param slippageBps Допустимое проскальзывание в базисных пунктах (1 bps = 0.01%)
 * @param retries Количество попыток при ошибке
 * @returns Данные котировки в случае успеха, null в случае ошибки
 */
async function getQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50, // 0.5% проскальзывание
  retries: number = 3
): Promise<JupiterQuoteResponse | null> {
  // Формируем URL запроса
  const url = `${JUPITER_API_URL}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;

  // Пытаемся получить котировку до retries раз
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      // Выполняем HTTP запрос
      const response = await fetch(url);
      
      // Проверяем статус ответа
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      
      // Преобразуем ответ в JSON
      const data = await response.json() as JupiterQuoteResponse;
      
      // Проверяем наличие ошибки в ответе
      if (data.error) {
        console.error(`Jupiter API вернул ошибку: ${data.error}`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return null;
      }
      
      // Проверяем наличие outAmount в ответе
      if (!data.outAmount) {
        console.warn(`Не найден маршрут обмена (попытка ${attempt}/${retries})`);
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return null;
      }
      
      // Возвращаем данные котировки
      return data;
      
    } catch (error) {
      console.error(`Ошибка при запросе (попытка ${attempt}/${retries}):`, error);
      
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  
  console.error(`Не удалось получить котировку после ${retries} попыток`);
  return null;
}

/**
 * Рассчитывает общую сумму комиссий из маршрута обмена в USD
 * @param quote Котировка с маршрутом обмена
 * @returns Сумма комиссий в USD
 */
function calculateFees(quote: JupiterQuoteResponse): number {
  if (!quote.routePlan || quote.routePlan.length === 0) {
    return 0;
  }
  
  let totalFees = 0;
  
  for (const { swapInfo } of quote.routePlan) {
    if (swapInfo.feeAmount && swapInfo.feeMint) {
      // Определяем тип токена комиссии и его decimals
      const isUSDC = swapInfo.feeMint === USDC;
      const isSOL = swapInfo.feeMint === SOL;
      const feeDecimals = isSOL ? 9 : 6;
      
      // Конвертируем сумму комиссии в человекочитаемый формат
      const feeValue = parseInt(swapInfo.feeAmount) / Math.pow(10, feeDecimals);
      
      // Если комиссия в USDC, добавляем напрямую к общей сумме
      if (isUSDC) {
        totalFees += feeValue;
      }
      // TODO: если комиссия в SOL, нужно конвертировать в USD
    }
  }
  
  return totalFees;
}

/**
 * Проверяет арбитражную возможность по схеме A->B->A
 * @param startToken Начальный токен (A)
 * @param middleToken Промежуточный токен (B) 
 * @param startAmount Начальная сумма в человекочитаемом формате (например, 1 SOL)
 * @returns Информация об арбитражной возможности или null, если профит ниже минимального порога
 */
async function checkArbitrageOpportunity(
  startToken: TokenInfo,
  middleToken: TokenInfo,
  startAmount: number
): Promise<ArbitrageOpportunity | null> {
  console.log(`\n🔍 Проверка арбитража: ${startToken.symbol} -> ${middleToken.symbol} -> ${startToken.symbol}`);
  
  // Конвертируем сумму в нативный формат с учетом decimals
  const startAmountNative = Math.floor(startAmount * Math.pow(10, startToken.decimals));
  
  // Шаг 1: A -> B (например, SOL -> USDC)
  console.log(`🔄 Шаг 1: Обмен ${startAmount} ${startToken.symbol} -> ${middleToken.symbol}`);
  
  const firstQuote = await getQuote(startToken.address, middleToken.address, startAmountNative);
  if (!firstQuote) {
    console.error(`❌ Не удалось получить котировку для ${startToken.symbol} -> ${middleToken.symbol}`);
    return null;
  }
  
  // Получаем сумму middleToken после первого обмена
  const middleAmountNative = parseInt(firstQuote.outAmount);
  const middleAmount = middleAmountNative / Math.pow(10, middleToken.decimals);
  
  console.log(`✅ Получено: ${middleAmount.toFixed(middleToken.decimals)} ${middleToken.symbol}`);
  
  // Выводим информацию о DEX для первого обмена
  if (firstQuote.routePlan && firstQuote.routePlan.length > 0) {
    const dexInfo: Record<string, number> = {};
    for (const route of firstQuote.routePlan) {
      const dexName = route.swapInfo.label || 'Неизвестный DEX';
      dexInfo[dexName] = (dexInfo[dexName] || 0) + route.percent;
    }
    
    console.log(`   📊 Использованные DEX: ${Object.entries(dexInfo)
      .map(([name, percent]) => `${name} (${percent}%)`)
      .join(', ')}`);
  }
  
  // Шаг 2: B -> A (например, USDC -> SOL)
  console.log(`🔄 Шаг 2: Обмен ${middleAmount.toFixed(middleToken.decimals)} ${middleToken.symbol} -> ${startToken.symbol}`);
  
  const secondQuote = await getQuote(middleToken.address, startToken.address, middleAmountNative);
  if (!secondQuote) {
    console.error(`❌ Не удалось получить котировку для ${middleToken.symbol} -> ${startToken.symbol}`);
    return null;
  }
  
  // Получаем итоговую сумму startToken после полного цикла обмена
  const finalAmountNative = parseInt(secondQuote.outAmount);
  const finalAmount = finalAmountNative / Math.pow(10, startToken.decimals);
  
  console.log(`✅ Получено: ${finalAmount.toFixed(startToken.decimals)} ${startToken.symbol}`);
  
  // Выводим информацию о DEX для второго обмена
  if (secondQuote.routePlan && secondQuote.routePlan.length > 0) {
    const dexInfo: Record<string, number> = {};
    for (const route of secondQuote.routePlan) {
      const dexName = route.swapInfo.label || 'Неизвестный DEX';
      dexInfo[dexName] = (dexInfo[dexName] || 0) + route.percent;
    }
    
    console.log(`   📊 Использованные DEX: ${Object.entries(dexInfo)
      .map(([name, percent]) => `${name} (${percent}%)`)
      .join(', ')}`);
  }
  
  // Расчет профита
  const profitAmountNative = finalAmountNative - startAmountNative;
  const profitAmount = profitAmountNative / Math.pow(10, startToken.decimals);
  const profitPercent = (profitAmountNative / startAmountNative) * 100;
  
  // Расчет комиссий
  const firstFees = calculateFees(firstQuote);
  const secondFees = calculateFees(secondQuote);
  const totalFees = firstFees + secondFees;
  
  // Формируем информацию об арбитражной возможности
  const opportunity: ArbitrageOpportunity = {
    startToken,
    middleToken,
    startAmount,
    startAmountNative,
    middleAmount,
    middleAmountNative,
    finalAmount,
    finalAmountNative,
    profitAmount,
    profitPercent,
    totalFees,
    firstQuote,
    secondQuote,
    timestamp: Date.now()
  };
  
  // Выводим итоговую информацию о потенциальной арбитражной возможности
  if (profitPercent > 0) {
    console.log(`📈 Профит: +${profitAmount.toFixed(startToken.decimals)} ${startToken.symbol} (+${profitPercent.toFixed(4)}%)`);
  } else {
    console.log(`📉 Убыток: ${profitAmount.toFixed(startToken.decimals)} ${startToken.symbol} (${profitPercent.toFixed(4)}%)`);
  }
  
  if (totalFees > 0) {
    console.log(`💸 Комиссии: ~$${totalFees.toFixed(6)}`);
  }
  
  // Проверяем достаточность профита
  if (profitPercent >= MIN_PROFIT_PERCENT) {
    console.log(`✅ Найдена прибыльная арбитражная возможность (профит > ${MIN_PROFIT_PERCENT}%)!`);
    return opportunity;
  } else {
    console.log(`❌ Арбитраж невыгоден (профит < ${MIN_PROFIT_PERCENT}%)`);
    return null;
  }
}

/**
 * Отображает информацию об арбитражной возможности в подробном формате
 * @param opportunity Арбитражная возможность
 */
function displayArbitrageOpportunity(opportunity: ArbitrageOpportunity): void {
  console.log('\n💰 НАЙДЕНА АРБИТРАЖНАЯ ВОЗМОЖНОСТЬ!');
  console.log('==================================================');
  
  // Основная информация о маршруте
  console.log(`🔄 Маршрут: ${opportunity.startToken.symbol} -> ${opportunity.middleToken.symbol} -> ${opportunity.startToken.symbol}`);
  
  // Информация о суммах обмена
  console.log(`\n📊 Детали обмена:`);
  console.log(`  • Начальная сумма: ${opportunity.startAmount.toFixed(opportunity.startToken.decimals)} ${opportunity.startToken.symbol}`);
  console.log(`  • Промежуточная сумма: ${opportunity.middleAmount.toFixed(opportunity.middleToken.decimals)} ${opportunity.middleToken.symbol}`);
  console.log(`  • Итоговая сумма: ${opportunity.finalAmount.toFixed(opportunity.startToken.decimals)} ${opportunity.startToken.symbol}`);
  
  // Информация о профите
  console.log(`\n💵 Результат:`);
  console.log(`  • Профит: +${opportunity.profitAmount.toFixed(opportunity.startToken.decimals)} ${opportunity.startToken.symbol}`);
  console.log(`  • Процент прибыли: +${opportunity.profitPercent.toFixed(4)}%`);
  
  // Информация о комиссиях
  console.log(`\n💸 Комиссии:`);
  console.log(`  • Общая сумма комиссий: ~$${opportunity.totalFees.toFixed(6)}`);
  
  // Детальная информация о маршрутах обмена
  console.log(`\n🛣️ Маршруты обмена:`);
  
  // Первый маршрут: A -> B (SOL -> USDC)
  console.log(`\n  1️⃣ ${opportunity.startToken.symbol} -> ${opportunity.middleToken.symbol}:`);
  if (opportunity.firstQuote.routePlan && opportunity.firstQuote.routePlan.length > 0) {
    // Создаем агрегированную статистику по DEX
    const dexSummary: Record<string, { percent: number }> = {};
    
    for (const route of opportunity.firstQuote.routePlan) {
      const dexName = route.swapInfo.label || 'Неизвестный DEX';
      if (!dexSummary[dexName]) {
        dexSummary[dexName] = { percent: 0 };
      }
      dexSummary[dexName].percent += route.percent;
      
      // Выводим информацию о шаге маршрута
      console.log(`    • ${dexName} (${route.percent}%):`);
      
      if (route.swapInfo.inAmount && route.swapInfo.outAmount) {
        const inDecimals = opportunity.startToken.decimals;
        const outDecimals = opportunity.middleToken.decimals;
        const inAmount = parseInt(route.swapInfo.inAmount) / Math.pow(10, inDecimals);
        const outAmount = parseInt(route.swapInfo.outAmount) / Math.pow(10, outDecimals);
        
        console.log(`      ${inAmount.toFixed(inDecimals)} ${opportunity.startToken.symbol} -> ${outAmount.toFixed(outDecimals)} ${opportunity.middleToken.symbol}`);
      }
      
      // Выводим информацию о комиссии
      if (route.swapInfo.feeAmount && route.swapInfo.feeMint) {
        const isUSDC = route.swapInfo.feeMint === USDC;
        const isSOL = route.swapInfo.feeMint === SOL;
        const feeDecimals = isSOL ? 9 : 6;
        const feeMintName = isSOL ? 'SOL' : (isUSDC ? 'USDC' : route.swapInfo.feeMint.slice(0, 6) + '...');
        const feeAmount = parseInt(route.swapInfo.feeAmount) / Math.pow(10, feeDecimals);
        
        console.log(`      Комиссия: ${feeAmount.toFixed(feeDecimals)} ${feeMintName}`);
      }
    }
    
    // Выводим сводную информацию по DEX
    console.log(`\n    📈 Распределение по DEX:`);
    for (const [dexName, stats] of Object.entries(dexSummary)) {
      console.log(`      • ${dexName}: ${stats.percent}%`);
    }
  } else {
    console.log(`    Нет информации о маршруте`);
  }
  
  // Второй маршрут: B -> A (USDC -> SOL)
  console.log(`\n  2️⃣ ${opportunity.middleToken.symbol} -> ${opportunity.startToken.symbol}:`);
  if (opportunity.secondQuote.routePlan && opportunity.secondQuote.routePlan.length > 0) {
    // Создаем агрегированную статистику по DEX
    const dexSummary: Record<string, { percent: number }> = {};
    
    for (const route of opportunity.secondQuote.routePlan) {
      const dexName = route.swapInfo.label || 'Неизвестный DEX';
      if (!dexSummary[dexName]) {
        dexSummary[dexName] = { percent: 0 };
      }
      dexSummary[dexName].percent += route.percent;
      
      // Выводим информацию о шаге маршрута
      console.log(`    • ${dexName} (${route.percent}%):`);
      
      if (route.swapInfo.inAmount && route.swapInfo.outAmount) {
        const inDecimals = opportunity.middleToken.decimals;
        const outDecimals = opportunity.startToken.decimals;
        const inAmount = parseInt(route.swapInfo.inAmount) / Math.pow(10, inDecimals);
        const outAmount = parseInt(route.swapInfo.outAmount) / Math.pow(10, outDecimals);
        
        console.log(`      ${inAmount.toFixed(inDecimals)} ${opportunity.middleToken.symbol} -> ${outAmount.toFixed(outDecimals)} ${opportunity.startToken.symbol}`);
      }
      
      // Выводим информацию о комиссии
      if (route.swapInfo.feeAmount && route.swapInfo.feeMint) {
        const isUSDC = route.swapInfo.feeMint === USDC;
        const isSOL = route.swapInfo.feeMint === SOL;
        const feeDecimals = isSOL ? 9 : 6;
        const feeMintName = isSOL ? 'SOL' : (isUSDC ? 'USDC' : route.swapInfo.feeMint.slice(0, 6) + '...');
        const feeAmount = parseInt(route.swapInfo.feeAmount) / Math.pow(10, feeDecimals);
        
        console.log(`      Комиссия: ${feeAmount.toFixed(feeDecimals)} ${feeMintName}`);
      }
    }
    
    // Выводим сводную информацию по DEX
    console.log(`\n    📈 Распределение по DEX:`);
    for (const [dexName, stats] of Object.entries(dexSummary)) {
      console.log(`      • ${dexName}: ${stats.percent}%`);
    }
  } else {
    console.log(`    Нет информации о маршруте`);
  }
  
  // Время обнаружения возможности
  console.log(`\n🕒 Время обнаружения: ${new Date(opportunity.timestamp).toISOString()}`);
  console.log('==================================================');
}

/**
 * Запускает мониторинг арбитражных возможностей между SOL и USDC
 * @param interval Интервал между проверками в миллисекундах
 * @param maxIterations Максимальное количество итераций (0 = бесконечно)
 */
async function startArbitrageMonitoring(
  intervalMs: number = 5000,
  maxIterations: number = 0
): Promise<void> {
  let iterations = 0;
  let isRunning = true;
  
  // Обработчик для корректного завершения при Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n🛑 Останавливаем мониторинг арбитража...');
    isRunning = false;
    // Даем время на завершение текущей итерации
    setTimeout(() => {
      console.log('👋 Мониторинг арбитража завершен');
      process.exit(0);
    }, 500);
  });
  
  // Начальная сумма для проверки арбитража (1 SOL)
  const startAmount = 1;
  
  console.log('\n🚀 Запуск мониторинга арбитражных возможностей:');
  console.log(`  • Интервал проверки: ${intervalMs / 1000} сек.`);
  console.log(`  • Максимум итераций: ${maxIterations === 0 ? 'бесконечно' : maxIterations}`);
  console.log(`  • Минимальный профит: ${MIN_PROFIT_PERCENT}%`);
  console.log(`  • Начальная сумма: ${startAmount} SOL`);
  console.log(`\n👉 Нажмите Ctrl+C для остановки\n`);
  
  // Основной цикл мониторинга
  while (isRunning && (maxIterations === 0 || iterations < maxIterations)) {
    // Увеличиваем счетчик итераций
    iterations++;
    
    console.log(`\n🔍 Итерация ${iterations}${maxIterations > 0 ? `/${maxIterations}` : ''}`);
    
    try {
      // Проверяем арбитражную возможность SOL -> USDC -> SOL
      const opportunity = await checkArbitrageOpportunity(
        TOKENS.SOL,
        TOKENS.USDC,
        startAmount
      );
      
      // Если найдена прибыльная возможность, отображаем подробную информацию
      if (opportunity) {
        displayArbitrageOpportunity(opportunity);
      }
      
      // Ожидаем до следующей итерации
      if (isRunning && (maxIterations === 0 || iterations < maxIterations)) {
        console.log(`\n⏳ Ожидание ${intervalMs / 1000} сек. до следующей проверки...`);
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    } catch (error) {
      console.error(`🔥 Критическая ошибка в мониторинге арбитража:`, error);
      // Ждем перед следующей попыткой в случае ошибки
      if (isRunning && (maxIterations === 0 || iterations < maxIterations)) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
  }
  
  console.log(`\n✅ Мониторинг арбитража завершен после ${iterations} итераций`);
}

// Экспортируем функции для использования в других модулях
export {
  startArbitrageMonitoring,
  checkArbitrageOpportunity,
  getQuote,
  TOKENS,
  MIN_PROFIT_PERCENT,
  ArbitrageOpportunity
};

// Если файл запускается напрямую, запускаем мониторинг
if (require.main === module) {
  startArbitrageMonitoring(5000, 3); // 5 секунд интервал, 3 итерации
} 