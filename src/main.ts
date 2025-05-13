import { startArbitrageMonitoring, MIN_PROFIT_PERCENT, TOKENS } from './arbitrage';

/**
 * Параметры по умолчанию для арбитражного бота
 */
const DEFAULT_CONFIG = {
  // Интервал между проверками в миллисекундах
  intervalMs: 5000,
  
  // Количество итераций (0 = бесконечно)
  maxIterations: 0,
  
  // Минимальный профит в процентах
  minProfitPercent: MIN_PROFIT_PERCENT
};

/**
 * Выводит информацию о использовании программы
 */
function printUsage(): void {
  console.log(`
🤖 Арбитражный бот для Solana (Jupiter API)

Использование:
  npm start -- [опции]

Опции:
  --interval=число   Интервал между проверками в секундах (по умолчанию: ${DEFAULT_CONFIG.intervalMs / 1000})
  --iterations=число Количество итераций (по умолчанию: ${DEFAULT_CONFIG.maxIterations === 0 ? 'бесконечно' : DEFAULT_CONFIG.maxIterations})
  --profit=число     Минимальный профит в процентах (по умолчанию: ${DEFAULT_CONFIG.minProfitPercent})
  --help, -h         Показать эту справку

Примеры:
  npm start
  npm start -- --interval=10 --iterations=5
  npm start -- --profit=0.8
  `);
}

/**
 * Парсит аргументы командной строки
 */
function parseCommandLineArgs(): { interval: number, iterations: number, profit: number } {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };
  
  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    
    const intervalMatch = arg.match(/^--interval=(\d+(\.\d+)?)$/);
    if (intervalMatch) {
      const value = parseFloat(intervalMatch[1]);
      if (!isNaN(value) && value > 0) {
        config.intervalMs = value * 1000; // Конвертируем секунды в миллисекунды
      } else {
        console.error('❌ Ошибка: Интервал должен быть положительным числом');
      }
      continue;
    }
    
    const iterationsMatch = arg.match(/^--iterations=(\d+)$/);
    if (iterationsMatch) {
      const value = parseInt(iterationsMatch[1], 10);
      if (!isNaN(value) && value >= 0) {
        config.maxIterations = value;
      } else {
        console.error('❌ Ошибка: Количество итераций должно быть неотрицательным целым числом');
      }
      continue;
    }
    
    const profitMatch = arg.match(/^--profit=(\d+(\.\d+)?)$/);
    if (profitMatch) {
      const value = parseFloat(profitMatch[1]);
      if (!isNaN(value) && value >= 0) {
        config.minProfitPercent = value;
      } else {
        console.error('❌ Ошибка: Минимальный профит должен быть неотрицательным числом');
      }
      continue;
    }
  }
  
  return {
    interval: config.intervalMs,
    iterations: config.maxIterations,
    profit: config.minProfitPercent
  };
}

/**
 * Главная функция для запуска арбитражного бота
 */
async function main(): Promise<void> {
  console.log('🚀 Запуск арбитражного бота на Solana...');
  
  // Парсим аргументы командной строки
  const { interval, iterations, profit } = parseCommandLineArgs();
  
  // Выводим информацию о токенах
  console.log('\n💱 Доступные токены:');
  for (const [key, token] of Object.entries(TOKENS)) {
    console.log(`  • ${token.symbol} (${token.address.slice(0, 6)}...${token.address.slice(-6)})`);
  }
  
  // Выводим информацию о параметрах запуска
  console.log('\n⚙️ Параметры запуска:');
  console.log(`  • Интервал проверки: ${interval / 1000} секунд`);
  console.log(`  • Количество итераций: ${iterations === 0 ? 'бесконечно' : iterations}`);
  console.log(`  • Минимальный профит: ${profit}%`);
  
  // Запускаем мониторинг арбитражных возможностей
  await startArbitrageMonitoring(interval, iterations);
}

// Запускаем программу
main().catch((error) => {
  console.error('🔥 Критическая ошибка:', error);
  process.exit(1);
}); 