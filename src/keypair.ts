import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import bs58 from 'bs58';

/**
 * Функция создает Keypair из приватного ключа base58
 * @param privateKeyBase58 приватный ключ в формате base58
 * @returns Keypair
 */
export function createKeypairFromPrivateKey(privateKeyBase58: string): Keypair {
  // Преобразуем строку с приватным ключом base58 в массив байтов
  const privateKeyBuffer = bs58.decode(privateKeyBase58);
  
  // Создаем экземпляр Keypair из массива байтов приватного ключа
  const keypair = Keypair.fromSecretKey(privateKeyBuffer);
  
  return keypair;
}

/**
 * Сохраняет Keypair в JSON файл
 * @param keypair Keypair для сохранения
 * @param filePath путь к файлу для сохранения
 */
export function saveKeypairToFile(keypair: Keypair, filePath: string): void {
  const keypairData = {
    publicKey: keypair.publicKey.toBase58(),
    secretKey: bs58.encode(keypair.secretKey)
  };
  
  // Используем writeFileSync вместо appendFileSync для перезаписи файла
  fs.writeFileSync(
    filePath, // Используем непосредственно путь без path.resolve
    JSON.stringify(keypairData, null, 2),
    'utf-8'
  );
}

/**
 * Загружает Keypair из JSON файла
 * @param filePath путь к файлу
 * @returns Keypair
 */
export function loadKeypairFromFile(filePath: string): Keypair {
  const keypairData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return createKeypairFromPrivateKey(keypairData.secretKey);
} 