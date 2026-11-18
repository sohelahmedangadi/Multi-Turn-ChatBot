import dotenv from 'dotenv';
dotenv.config();
import { ChromaClient } from 'chromadb';
import fs from 'fs';
import path from 'path';
import { createDeterministicDenseEmbedding } from '../server/services/chromaService.js';

const cosmoEmbeddingFunction = {
  generate: async (texts) => texts.map((t) => createDeterministicDenseEmbedding(t, 256)),
};

const chromaUrl = process.env.CHROMA_URL || 'http://127.0.0.1:8000';

async function main() {
  console.log('\n======================================================');
  console.log('🔮 CHROMADB & MEMORY INSPECTOR');
  console.log('======================================================\n');
  console.log(`Connecting to Chroma DB at: ${chromaUrl} ...`);

  let isConnected = false;
  let client = null;

  try {
    const parsed = new URL(chromaUrl);
    client = new ChromaClient({
      host: parsed.hostname || '127.0.0.1',
      port: Number(parsed.port) || 8000,
      ssl: parsed.protocol === 'https:',
    });

    await Promise.race([
      client.heartbeat(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 2000)),
    ]);
    isConnected = true;
    console.log('✅ Connected to Chroma DB server!\n');
  } catch (err) {
    console.log(`ℹ️ Chroma DB server is NOT currently running at ${chromaUrl}`);
    console.log(`   Reason: ${err.message}\n`);
    console.log('👉 To start Chroma DB, run one of these in a separate terminal:');
    console.log('   Docker:  docker run -p 8000:8000 chromadb/chroma');
    console.log('   Python:  chroma run --path ./chroma_data\n');
  }

  if (isConnected && client) {
    try {
      const collections = await client.listCollections();
      console.log(`Found ${collections.length} collection(s) in Chroma DB:\n`);

      for (const coll of collections) {
        const name = typeof coll === 'string' ? coll : coll.name;
        console.log(`📦 Collection: "${name}"`);
        const collection = await client.getCollection({ name, embeddingFunction: cosmoEmbeddingFunction });
        const count = await collection.count();
        console.log(`   Total items: ${count}`);

        if (count > 0) {
          const records = await collection.get({
            limit: 50,
            include: ['documents', 'metadatas'],
          });

          for (let i = 0; i < records.ids.length; i++) {
            console.log(`   ──────────────────────────────────────────────────`);
            console.log(`   • ID:       ${records.ids[i]}`);
            console.log(`   • Document: ${records.documents[i] || '(empty)'}`);
            if (records.metadatas && records.metadatas[i]) {
              console.log(`   • Metadata:`, JSON.stringify(records.metadatas[i], null, 2).replace(/\n/g, '\n     '));
            }
          }
        } else {
          console.log('   (Empty collection)');
        }
        console.log('\n');
      }
    } catch (collErr) {
      console.error('Error fetching Chroma collections:', collErr.message);
    }
  }

  // Also display local store memories
  const localStorePath = path.resolve('data/local_store.json');
  if (fs.existsSync(localStorePath)) {
    try {
      const localData = JSON.parse(fs.readFileSync(localStorePath, 'utf8'));
      const memories = localData.memories || {};
      const userCount = Object.keys(memories).length;
      let totalMemories = 0;
      for (const memList of Object.values(memories)) {
        totalMemories += Array.isArray(memList) ? memList.length : 0;
      }
      console.log('======================================================');
      console.log(`💾 Local Persistent Store Memories (data/local_store.json):`);
      console.log(`   Users: ${userCount} | Total Memories: ${totalMemories}`);
      for (const [uid, memList] of Object.entries(memories)) {
        if (Array.isArray(memList) && memList.length > 0) {
          console.log(`\n   👤 User: "${uid}"`);
          for (const m of memList) {
            console.log(`      • [${m.key}]: "${m.fact}" (${m.category})`);
          }
        }
      }
      console.log('======================================================\n');
    } catch (e) {
      // ignore
    }
  }
}

main();

