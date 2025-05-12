import { createDevnetRPC } from "./rpc";

const pubkey = "9FwgC1EBf3kzaKuPrPtjpzXGEqUPFpZP4fwWiURxnuNe"; // замените на актуальный publicKey

async function test() {
  const rpc = createDevnetRPC();

  const isConnected = await rpc.isConnected();
  console.log("🔌 Connected to Solana RPC:", isConnected);

  const balance = await rpc.getBalance(pubkey);
  console.log("💰 Balance:", balance, "SOL");

  const slot = await rpc.getSlot();
  console.log("📦 Current slot:", slot);

  const version = await rpc.getVersion();
  console.log("🛠️ Node version:", version);

  const latency = await rpc.ping();
  console.log("⏱️ Ping:", latency, "ms");
}

test();
