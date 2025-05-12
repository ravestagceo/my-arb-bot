# Address Lookup Tables (ALT) в Solana

## Обзор
Address Lookup Tables (ALT) - это специальные таблицы в Solana, которые позволяют сократить размер транзакций за счет хранения часто используемых адресов в отдельной on-chain структуре и ссылки на них вместо включения полных 32-байтных адресов в каждую транзакцию.

## Преимущества ALT
- Значительное снижение размера транзакций (до 30%)
- Уменьшение комиссий за транзакции
- Возможность создания более сложных транзакций в рамках лимита размера
- Повышение эффективности при работе с множеством различных адресов

## Создание и управление ALT
```typescript
import { 
  Connection, 
  PublicKey,
  AddressLookupTableProgram,
  TransactionMessage,
  VersionedTransaction,
  sendAndConfirmTransaction
} from '@solana/web3.js';

async function createAndPopulateALT(
  connection: Connection, 
  payer: Keypair, 
  addresses: PublicKey[]
) {
  // 1. Создание ALT
  const [createInstruction, lookupTableAddress] = 
    AddressLookupTableProgram.createLookupTable({
      authority: payer.publicKey,
      payer: payer.publicKey,
      recentSlot: await connection.getSlot()
    });
  
  // 2. Добавление адресов в ALT
  const extendInstruction = AddressLookupTableProgram.extendLookupTable({
    payer: payer.publicKey,
    authority: payer.publicKey,
    lookupTable: lookupTableAddress,
    addresses: addresses
  });
  
  // Создание и отправка транзакции
  const blockhash = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash.blockhash,
    instructions: [createInstruction, extendInstruction]
  }).compileToV0Message();
  
  const transaction = new VersionedTransaction(messageV0);
  transaction.sign([payer]);
  
  await sendAndConfirmTransaction(connection, transaction, [payer]);
  
  return lookupTableAddress;
}
```

## Использование ALT в транзакциях
```typescript
async function createTransactionWithALT(
  connection: Connection,
  payer: Keypair,
  instructions: TransactionInstruction[],
  lookupTableAddresses: PublicKey[]
) {
  const blockhash = await connection.getLatestBlockhash();
  
  // Получаем таблицы ALT
  const lookupTables = await Promise.all(
    lookupTableAddresses.map(address => 
      connection.getAddressLookupTable(address).then(res => res.value)
    )
  );
  
  // Создаем сообщение с ALT
  const messageV0 = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash.blockhash,
    instructions
  }).compileToV0Message(lookupTables.filter(Boolean));
  
  // Создаем версионированную транзакцию
  return new VersionedTransaction(messageV0);
}
```

## Полезные ссылки
- [Официальная документация по ALT](https://docs.solana.com/developing/lookup-tables)
- [Solana Cookbook: ALT](https://solanacookbook.com/guides/versioned-transactions.html)

## Примечания для арбитража
- ALT особенно полезны для арбитражных операций, где используется множество токенов, DEX и программ
- Рекомендуется создать отдельные ALT для различных категорий адресов:
  * Основные DEX программы (Jupiter, Orca, Raydium)
  * Популярные токены (USDC, SOL, BTC, ETH)
  * Служебные программы (System Program, Token Program)
- ALT требуют одноразовой оплаты за создание и добавление адресов, но экономят на комиссиях в долгосрочной перспективе 