// Скрипт для сохранения Solana Keypair в файл
const { Keypair } = require('@solana/web3.js');
const bs58Module = require('bs58');
const fs = require('fs');
const path = require('path');

// Правильное получение экспорта bs58
const bs58 = bs58Module.default || bs58Module;

// Приватный ключ в base58
const privateKeyStr = '3fadotsLpUpgdpyk9VVtE25X5ZUaDgcbACFFPeESWdwjM6B1DBs8SHNjAyTbbjXKvfXs1ZN852ZE1U7346SmM8HL';

try {
  // Декодируем ключ
  const secretKey = bs58.decode(privateKeyStr);
  
  // Создаем keypair
  const keypair = Keypair.fromSecretKey(secretKey);
  
  // Публичный ключ
  const publicKey = keypair.publicKey.toString();
  
  // Выводим информацию о кошельке
  console.log('===============================');
  console.log('SOLANA KEYPAIR INFORMATION:');
  console.log('===============================');
  console.log('Public Key:', publicKey);
  console.log('===============================');
  
  // Создаем объект для сохранения
  const walletData = {
    publicKey: publicKey,
    secretKey: privateKeyStr
  };
  
  // Путь к файлу
  const walletFilePath = path.join(process.cwd(), 'solana-wallet.json');
  
  // Сохраняем в файл
  fs.writeFileSync(walletFilePath, JSON.stringify(walletData, null, 2));
  
  console.log(`\nКошелек успешно сохранен в файл: ${walletFilePath}`);
  
} catch (error) {
  console.error('Ошибка:', error.message);
} 