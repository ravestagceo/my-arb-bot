import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl, Commitment, Cluster, Message, SystemProgram, VersionedMessage } from '@solana/web3.js';

/**
 * Доступные сети Solana
 */
export enum SolanaCluster {
  MAINNET = 'mainnet-beta',
  DEVNET = 'devnet',
  TESTNET = 'testnet',
  LOCALNET = 'localhost'
}

/**
 * Класс для работы с Solana RPC
 */
export class SolanaRPC {
  private connection: Connection;
  private readonly endpoint: string;
  private readonly commitment: Commitment;
  private readonly cluster: SolanaCluster;

  /**
   * Создает экземпляр RPC подключения к Solana
   * @param cluster Кластер Solana (mainnet, devnet, testnet, localnet)
   * @param customEndpoint Пользовательский эндпоинт (опционально)
   * @param commitment Уровень подтверждения транзакций
   */
  constructor(
    cluster: SolanaCluster = SolanaCluster.DEVNET,
    customEndpoint?: string,
    commitment: Commitment = 'confirmed'
  ) {
    this.cluster = cluster;
    this.commitment = commitment;
    
    if (customEndpoint) {
      this.endpoint = customEndpoint;
    } else {
      // Приводим SolanaCluster к типу Cluster для использования с clusterApiUrl
      this.endpoint = clusterApiUrl(cluster as Cluster);
    }
    
    this.connection = new Connection(this.endpoint, this.commitment);
    
    console.log(`Solana RPC initialized for ${cluster} at ${this.endpoint}`);
  }

  /**
   * Получить экземпляр Connection
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Получить баланс аккаунта
   * @param address Адрес аккаунта или PublicKey
   * @returns Баланс в SOL
   */
  async getBalance(address: string | PublicKey): Promise<number> {
    const publicKey = typeof address === 'string' ? new PublicKey(address) : address;
    const balance = await this.connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Получить текущий слот
   */
  async getSlot(): Promise<number> {
    return await this.connection.getSlot();
  }

  /**
   * Получить версию ноды
   */
  async getVersion(): Promise<string> {
    const version = await this.connection.getVersion();
    return version['solana-core'];
  }

  /**
   * Проверить подключение
   * @returns true если подключение активно
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.connection.getEpochInfo();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Пинг ноды для проверки задержки
   */
  async ping(): Promise<number> {
    const start = Date.now();
    await this.getSlot();
    return Date.now() - start;
  }

  /**
   * Получить информацию о последнем блокхеше
   */
  async getLatestBlockhash(): Promise<string> {
    const { blockhash } = await this.connection.getLatestBlockhash();
    return blockhash;
  }
  
  /**
   * Получить приблизительную комиссию для транзакции
   * Возвращает фиксированное значение, так как расчет точной комиссии требует
   * создания полного сообщения транзакции
   */
  getEstimatedTransactionFee(): number {
    // Стандартная комиссия для простой транзакции составляет примерно 5000 lamports (0.000005 SOL)
    return 5000;
  }
}

/**
 * Создает экземпляр SolanaRPC для devnet
 */
export function createDevnetRPC(): SolanaRPC {
  return new SolanaRPC(SolanaCluster.DEVNET, 'https://api.devnet.solana.com');
}

/**
 * Создает экземпляр SolanaRPC для mainnet
 */
export function createMainnetRPC(): SolanaRPC {
  return new SolanaRPC(SolanaCluster.MAINNET);
}

// Пример использования:
// const rpc = createDevnetRPC();
// const balance = await rpc.getBalance('YOUR_ADDRESS');
// console.log(`Balance: ${balance} SOL`); 