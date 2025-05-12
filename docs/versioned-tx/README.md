# Versioned Transactions в Solana

## Обзор
Versioned Transactions - это улучшенный формат транзакций в Solana, позволяющий использовать более эффективные подписи, адресные таблицы и другие оптимизации для снижения размера транзакций и комиссий.

## Ключевые концепции
- **Legacy-транзакции vs Versioned-транзакции** - разница в структуре и возможностях
- **Address Lookup Tables (ALT)** - таблицы для ссылки на адреса, снижающие размер транзакций
- **Подписи Ed25519** - стандартный метод подписи в Solana

## Преимущества Versioned Transactions
- Меньший размер транзакций при использовании ALT
- Поддержка новых форматов подписей
- Улучшенная производительность
- Меньшие комиссии за транзакции

## Работа с Versioned Transactions
```typescript
// Пример создания Versioned Transaction
import { 
  VersionedTransaction, 
  TransactionMessage,
  PublicKey,
  Connection 
} from '@solana/web3.js';

async function createVersionedTransaction(connection, feePayer, instructions) {
  // Получаем последний blockhash
  const { blockhash } = await connection.getLatestBlockhash();
  
  // Создаем сообщение транзакции
  const messageV0 = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions
  }).compileToV0Message();
  
  // Создаем версионированную транзакцию
  return new VersionedTransaction(messageV0);
}
```

## Интеграция с ALT
Для использования Address Lookup Tables с Versioned Transactions необходимо:
1. Создать таблицу ALT
2. Добавить в нее адреса
3. Использовать ссылки на ALT в транзакции

## Полезные ссылки
- [Solana Transaction Format](https://docs.solana.com/developing/programming-model/transactions)
- [Versioned Transactions docs](https://docs.solana.com/developing/versioned-transactions)
- [Address Lookup Tables](https://docs.solana.com/developing/lookup-tables)

## Примечания по арбитражу
- Versioned Transactions являются предпочтительным форматом для арбитражных операций из-за возможности оптимизации размера и комиссий
- Комбинация с ALT особенно полезна при работе с множеством DEX и токенов
- Совместимость с Jito Bundles для MEV-защиты 