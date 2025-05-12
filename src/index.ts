import { createKeypairFromPrivateKey, saveKeypairToFile } from './keypair';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Приватный ключ 
const privateKeyBase58 = '3fadotsLpUpgdpyk9VVtE25X5ZUaDgcbACFFPeESWdwjM6B1DBs8SHNjAyTbbjXKvfXs1ZN852ZE1U7346SmM8HL';

async function main() {
  console.log('🟢 Создаем Solana Keypair из приватного ключа...');

  try {
    // Создаем keypair из приватного ключа
    const keypair = createKeypairFromPrivateKey(privateKeyBase58);
    
    // Выводим публичный ключ
    console.log(`✅ Keypair успешно создан`);
    console.log(`📝 Публичный ключ: ${keypair.publicKey.toBase58()}`);
    
    // Сохраняем keypair в файл
    const keypairPath = './wallet.json';
    saveKeypairToFile(keypair, keypairPath);
    console.log(`💾 Keypair сохранен в файл: ${keypairPath}`);
    
    // Подключаемся к Solana devnet и проверяем баланс
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const balance = await connection.getBalance(keypair.publicKey);
    console.log(`💰 Баланс: ${balance / LAMPORTS_PER_SOL} SOL`);
    
  } catch (error) {
    console.error('❌ Ошибка при работе с Keypair:', error);
  }
}

main();
