import fetch from 'node-fetch';

// Константы API и токенов
const JUPITER_API_URL = 'https://quote-api.jup.ag/v6/quote';
const SOL = 'So11111111111111111111111111111111111111112';
const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

// Адреса известных DEX-ов для удобства распознавания
const DEX_NAMES: Record<string, string> = {
  'So11111111111111111111111111111111111111112': 'SOL',
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT'
};

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

/**
 * Получает котировку для обмена токенов через Jupiter API 
 * Показывает сколько USDC можно получить за 1 SOL
 * @param retries Количество попыток при ошибке
 * @returns Данные котировки в случае успеха, null в случае ошибки
 */
async function getQuote(
  amount: number = 1 * 1_000_000_000, // 1 SOL в lamports
  slippageBps: number = 50, // 0.5% проскальзывание
  retries: number = 3
): Promise<JupiterQuoteResponse | null> {
  // Формируем URL запроса
  const url = `${JUPITER_API_URL}?inputMint=${SOL}&outputMint=${USDC}&amount=${amount}&slippageBps=${slippageBps}`;

  // Пытаемся получить котировку до retries раз
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[${new Date().toISOString()}] Попытка ${attempt}/${retries}: получение котировки SOL → USDC...`);
      
      // Выполняем HTTP запрос
      const startTime = performance.now();
      const response = await fetch(url);
      const endTime = performance.now();
      const requestTime = endTime - startTime;
      
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
          console.log(`Повторная попытка через 1 секунду...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return null;
      }
      
      // Проверяем наличие outAmount в ответе
      if (!data.outAmount) {
        console.warn(`Не найден маршрут обмена (попытка ${attempt}/${retries})`);
        if (attempt < retries) {
          console.log(`Повторная попытка через 1 секунду...`);
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
        return null;
      }
      
      // Замеряем общее время запроса
      console.log(`⏱️ Время HTTP запроса: ${requestTime.toFixed(2)} мс`);
      
      // Возвращаем данные котировки
      return data;
      
    } catch (error) {
      console.error(`Ошибка при запросе (попытка ${attempt}/${retries}):`, error);
      
      if (attempt < retries) {
        console.log(`Повторная попытка через 1 секунду...`);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
  
  console.error(`Не удалось получить котировку после ${retries} попыток`);
  return null;
}

/**
 * Форматирует вывод большого числа токенов в понятный вид
 */
function formatTokenAmount(amount: string, decimals: number = 6): string {
  const value = parseInt(amount) / Math.pow(10, decimals);
  return value.toFixed(decimals);
}

/**
 * Вычисляет и форматирует обменный курс
 */
function calculateExchangeRate(inAmount: string, outAmount: string, inDecimals: number = 9, outDecimals: number = 6): string {
  const inValue = parseInt(inAmount) / Math.pow(10, inDecimals);
  const outValue = parseInt(outAmount) / Math.pow(10, outDecimals);
  const rate = outValue / inValue;
  return rate.toFixed(4);
}

/**
 * Получает дружественное имя токена
 */
function getTokenName(mintAddress: string): string {
  return DEX_NAMES[mintAddress] || mintAddress.slice(0, 4) + '...' + mintAddress.slice(-4);
}

/**
 * Обрабатывает и выводит результаты запроса котировки
 */
function displayQuote(quote: JupiterQuoteResponse): void {
  // Выводим основную информацию о курсе
  console.log('\n✅ Котировка успешно получена:');
  
  const solAmount = formatTokenAmount(quote.inAmount, 9);
  const usdcAmount = formatTokenAmount(quote.outAmount, 6);
  const exchangeRate = calculateExchangeRate(quote.inAmount, quote.outAmount);
  
  console.log(`🔄 ${solAmount} SOL = ${usdcAmount} USDC (курс: 1 SOL = ${exchangeRate} USDC)`);
  
  // Выводим информацию о проскальзывании
  const priceImpact = parseFloat(quote.priceImpactPct) * 100;
  console.log(`📉 Проскальзывание: ${priceImpact.toFixed(6)}%`);
  
  // Выводим информацию о стоимости в USD
  console.log(`💵 Стоимость сделки: ~$${usdcAmount}`);
  
  // Выводим детальную информацию о маршруте и DEX
  console.log('\n📊 Маршрут обмена:');
  
  if (quote.routePlan && quote.routePlan.length > 0) {
    // Расчет общих комиссий
    let totalFees = 0;
    const fees: Record<string, number> = {};
    
    for (let i = 0; i < quote.routePlan.length; i++) {
      const { swapInfo, percent } = quote.routePlan[i];
      
      // Отображаем основную информацию о шаге маршрута
      console.log(`  ${i + 1}. ${swapInfo.label || 'Unknown DEX'} (${percent}%)`);
      
      // Отображаем информацию о входящем и исходящем токене
      if (swapInfo.inAmount && swapInfo.outAmount) {
        const inToken = getTokenName(swapInfo.inputMint || '');
        const outToken = getTokenName(swapInfo.outputMint || '');
        
        const inAmountFormatted = formatTokenAmount(
          swapInfo.inAmount, 
          inToken === 'SOL' ? 9 : 6
        );
        
        const outAmountFormatted = formatTokenAmount(
          swapInfo.outAmount, 
          outToken === 'SOL' ? 9 : 6
        );
        
        console.log(`     Обмен: ${inAmountFormatted} ${inToken} → ${outAmountFormatted} ${outToken}`);
        
        // Отображаем курс обмена на этом шаге
        const stepRate = calculateExchangeRate(
          swapInfo.inAmount, 
          swapInfo.outAmount,
          inToken === 'SOL' ? 9 : 6,
          outToken === 'SOL' ? 9 : 6
        );
        
        console.log(`     Курс: 1 ${inToken} = ${stepRate} ${outToken}`);
      }
      
      // Отображаем информацию о комиссии
      if (swapInfo.feeAmount && swapInfo.feeMint) {
        const feeMintName = getTokenName(swapInfo.feeMint);
        const feeDecimals = feeMintName === 'SOL' ? 9 : 6;
        const feeAmountFormatted = formatTokenAmount(swapInfo.feeAmount, feeDecimals);
        
        console.log(`     Комиссия: ${feeAmountFormatted} ${feeMintName}`);
        
        // Суммируем комиссии по типам токенов
        const feeValue = parseInt(swapInfo.feeAmount) / Math.pow(10, feeDecimals);
        if (!fees[feeMintName]) {
          fees[feeMintName] = 0;
        }
        fees[feeMintName] += feeValue;
        
        // Если комиссия в USDC или USDT, добавляем к общей стоимости в USD
        if (feeMintName === 'USDC' || feeMintName === 'USDT') {
          totalFees += feeValue;
        }
      }
      
      // Отображаем дополнительную информацию о DEX
      if (swapInfo.ammKey) {
        console.log(`     ID DEX: ${swapInfo.ammKey.slice(0, 8)}...${swapInfo.ammKey.slice(-8)}`);
      }
      
      // Разделитель между шагами маршрута
      if (i < quote.routePlan.length - 1) {
        console.log(`     ↓`);
      }
    }
    
    // Выводим суммарную информацию о комиссиях
    console.log(`\n💸 Суммарные комиссии:`);
    for (const [token, amount] of Object.entries(fees)) {
      console.log(`  • ${amount.toFixed(6)} ${token}`);
    }
    
    // Если есть комиссии в стейблкоинах, показываем общую стоимость
    if (totalFees > 0) {
      console.log(`  • Общая стоимость комиссий: ~$${totalFees.toFixed(6)}`);
    }
  } else {
    console.log('  Информация о маршруте недоступна');
  }
  
  // Выводим дополнительную информацию
  console.log(`\n⏱️ Время запроса API: ${(quote.timeTaken * 1000).toFixed(2)} мс`);
  console.log(`📦 Слот блокчейна: ${quote.contextSlot}`);
  console.log(`🕒 Временная метка: ${new Date().toISOString()}\n`);
}

/**
 * Периодически опрашивает Jupiter API для получения котировок
 * @param intervalMs Интервал между запросами в миллисекундах
 * @param maxIterations Максимальное количество итераций (0 = бесконечно)
 */
async function startPriceMonitoring(intervalMs: number = 1000, maxIterations: number = 0): Promise<void> {
  let iterations = 0;
  let isRunning = true;
  
  // Обработчик для корректного завершения при Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n🛑 Останавливаем мониторинг цен...');
    isRunning = false;
    // Даем время на завершение текущей итерации
    setTimeout(() => {
      console.log('👋 Мониторинг цен завершен');
      process.exit(0);
    }, 500);
  });
  
  console.log(`\n🔍 Запуск мониторинга цен SOL → USDC с интервалом ${intervalMs / 1000} сек...`);
  console.log(`👉 Нажмите Ctrl+C для остановки\n`);
  
  // Массив для хранения истории цен
  const priceHistory: {timestamp: number, price: number}[] = [];
  
  // Основной цикл мониторинга
  while (isRunning && (maxIterations === 0 || iterations < maxIterations)) {
    // Увеличиваем счетчик итераций
    iterations++;
    
    // Таймер начала запроса
    const startTime = Date.now();
    
    try {
      // Получаем котировку
      const quote = await getQuote();
      
      if (quote) {
        // Выводим информацию о котировке
        displayQuote(quote);
        
        // Сохраняем данные о цене
        const price = parseInt(quote.outAmount) / 1_000_000;
        priceHistory.push({
          timestamp: Date.now(),
          price: price
        });
        
        // Сохраняем только последние 10 цен
        if (priceHistory.length > 10) {
          priceHistory.shift();
        }
        
        // Анализируем изменение цены
        if (priceHistory.length >= 2) {
          const lastPrice = priceHistory[priceHistory.length - 1].price;
          const prevPrice = priceHistory[priceHistory.length - 2].price;
          const priceDiff = lastPrice - prevPrice;
          const priceDiffPercent = (priceDiff / prevPrice) * 100;
          
          let changeIndicator = '→';
          if (priceDiff > 0) changeIndicator = '↗️';
          if (priceDiff < 0) changeIndicator = '↘️';
          
          console.log(`${changeIndicator} Изменение цены: ${priceDiffPercent > 0 ? '+' : ''}${priceDiffPercent.toFixed(6)}%`);
        }
      } else {
        console.log(`❌ Не удалось получить котировку (итерация ${iterations})`);
      }
      
      // Вычисляем оставшееся время до следующего запроса
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, intervalMs - elapsedTime);
      
      if (remainingTime > 0 && isRunning && (maxIterations === 0 || iterations < maxIterations)) {
        console.log(`⏳ Ожидание ${remainingTime}мс до следующего запроса...\n`);
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
    } catch (error) {
      console.error(`🔥 Критическая ошибка в мониторинге:`, error);
      // Ждем перед следующей попыткой в случае ошибки
      if (isRunning && (maxIterations === 0 || iterations < maxIterations)) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
  }
  
  console.log(`\n✅ Мониторинг завершен после ${iterations} итераций`);
}

// Запускаем мониторинг цен с интервалом 1 секунда
// Для тестирования установим 5 итераций, для реального использования установите 0 для бесконечного мониторинга
startPriceMonitoring(1000, 5);