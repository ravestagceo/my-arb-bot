# Настройка и использование Solana RPC

## Что реализовано

В проекте реализован модуль `SolanaRPC` для работы с блокчейном Solana через RPC подключение. Этот модуль предоставляет удобные методы для взаимодействия с сетью.

## Основные файлы

1. **src/rpc.ts** - основной модуль с классом `SolanaRPC` и вспомогательными функциями
2. **src/rpc-example.ts** - пример использования модуля
3. **src/rpc-test.ts** - скрипт для тестирования RPC подключения

## Использование модуля SolanaRPC

### Создание подключения

```typescript
import { createDevnetRPC, SolanaCluster, SolanaRPC } from './rpc';

// Создание подключения к devnet через фабричную функцию
const devnetRPC = createDevnetRPC();

// Создание подключения с указанием кластера
const testnetRPC = new SolanaRPC(SolanaCluster.TESTNET);

// Создание подключения с пользовательским URL
const customRPC = new SolanaRPC(
  SolanaCluster.DEVNET,
  'https://my-solana-node.example.com'
);
```

### Проверка подключения

```typescript
// Проверка активности подключения
const isConnected = await rpc.isConnected();
console.log(`Подключение: ${isConnected ? 'активно' : 'недоступно'}`);

// Проверка версии ноды
const version = await rpc.getVersion();
console.log(`Версия Solana: ${version}`);

// Проверка текущего слота
const slot = await rpc.getSlot();
console.log(`Текущий слот: ${slot}`);

// Измерение задержки (ping)
const pingTime = await rpc.ping();
console.log(`Пинг: ${pingTime}ms`);
```

### Получение баланса

```typescript
import { PublicKey } from '@solana/web3.js';

// Получение баланса по адресу в виде строки
const balance1 = await rpc.getBalance('9FwgC1EBf3kzaKuPrPtjpzXGEqUPFpZP4fwWiURxnuNe');
console.log(`Баланс: ${balance1} SOL`);

// Получение баланса по объекту PublicKey
const publicKey = new PublicKey('9FwgC1EBf3kzaKuPrPtjpzXGEqUPFpZP4fwWiURxnuNe');
const balance2 = await rpc.getBalance(publicKey);
console.log(`Баланс: ${balance2} SOL`);
```

### Работа с блокхешем и комиссиями

```typescript
// Получение последнего блокхеша
const blockhash = await rpc.getLatestBlockhash();
console.log(`Последний blockhash: ${blockhash}`);

// Получение приблизительной комиссии
const fee = rpc.getEstimatedTransactionFee();
console.log(`Комиссия: ${fee / 1_000_000_000} SOL (${fee} lamports)`);
```

## Доступные RPC эндпоинты

### Публичные эндпоинты

1. **Devnet**:
   - `https://api.devnet.solana.com` (основной)
   - `https://api.testnet.solana.com`

2. **Mainnet**:
   - `https://api.mainnet-beta.solana.com`
   - `https://solana-api.projectserum.com`

### Использование эндпоинтов через clusterApiUrl

```typescript
import { clusterApiUrl } from '@solana/web3.js';

// Получение URL для devnet
const devnetUrl = clusterApiUrl('devnet');

// Получение URL для mainnet
const mainnetUrl = clusterApiUrl('mainnet-beta');
```

## Результаты тестирования

Выполнено успешное тестирование RPC подключения к Solana devnet:

- ✅ Подключение к devnet активно
- ✅ Версия Solana: 2.2.12
- ✅ Текущий слот: 380367303
- ✅ Пинг до ноды: 152ms
- ✅ Баланс кошелька: 1 SOL
- ✅ Получен последний blockhash
- ✅ Расчетная комиссия: 0.000005 SOL (5000 lamports)

Тестирование доступности различных сетей:
- ✅ Devnet: подключено (пинг: 161ms)
- ✅ Testnet: подключено (пинг: 42ms)

## Дальнейшие улучшения

1. Реализовать кеширование подключений для оптимизации производительности
2. Добавить автоматическое переключение между нодами при недоступности
3. Реализовать мониторинг производительности RPC подключения
4. Добавить поддержку WebSocket подключения для получения обновлений в реальном времени 