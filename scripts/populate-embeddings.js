/**
 * Populate vector embeddings for all tools in the ToolRoute Supabase database.
 * Uses OpenAI text-embedding-3-small (1536 dimensions) and updates via service role key.
 */

// Load from env vars or .env.local — never hardcode secrets
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://isbratmfnnzipzyoefbo.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Read OpenAI key from openclaw config
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || (() => {
  try { return require('C:/Users/Not John Or Justin/.openclaw-v2/openclaw.json').plugins.entries['memory-lancedb'].config.embedding.apiKey; }
  catch { return null; }
})();
if (!OPENAI_API_KEY) { console.error('Set OPENAI_API_KEY or ensure openclaw.json exists'); process.exit(1); }
if (!SUPABASE_SERVICE_KEY) { console.error('Set SUPABASE_SERVICE_ROLE_KEY env var'); process.exit(1); }
const EMBEDDING_MODEL = 'text-embedding-3-small';
const BATCH_SIZE = 10;

async function fetchAllTools() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/tools?select=id,name,slug,description,capabilities,super_category,sub_category&order=name`,
    {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch tools: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

function buildEmbeddingText(tool) {
  const caps = Array.isArray(tool.capabilities)
    ? tool.capabilities.join(', ')
    : (tool.capabilities || '');
  return `${tool.name}: ${tool.description}. Capabilities: ${caps}. Category: ${tool.super_category}/${tool.sub_category}`;
}

async function getEmbeddings(texts) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: texts,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${body}`);
  }
  const data = await res.json();
  // Return embeddings sorted by index to match input order
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

async function updateToolEmbedding(toolId, embedding) {
  // Convert embedding array to Supabase pgvector format: "[0.1,0.2,...]"
  const vectorStr = `[${embedding.join(',')}]`;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/tools?id=eq.${toolId}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify({ embedding: vectorStr }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase update error for ${toolId}: ${res.status} ${body}`);
  }
  return true;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('Fetching all tools from ToolRoute...');
  const tools = await fetchAllTools();
  console.log(`Found ${tools.length} tools.`);

  let successCount = 0;
  let failCount = 0;

  // Process in batches
  for (let i = 0; i < tools.length; i += BATCH_SIZE) {
    const batch = tools.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(tools.length / BATCH_SIZE);
    console.log(`\nBatch ${batchNum}/${totalBatches} (${batch.length} tools):`);

    // Build embedding texts for batch
    const texts = batch.map(buildEmbeddingText);

    try {
      // Get embeddings from OpenAI
      const embeddings = await getEmbeddings(texts);
      console.log(`  Got ${embeddings.length} embeddings (${embeddings[0].length} dimensions each)`);

      // Update each tool in Supabase
      for (let j = 0; j < batch.length; j++) {
        try {
          await updateToolEmbedding(batch[j].id, embeddings[j]);
          successCount++;
          console.log(`  [OK] ${batch[j].name}`);
        } catch (err) {
          failCount++;
          console.error(`  [FAIL] ${batch[j].name}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`  [BATCH FAIL] ${err.message}`);
      failCount += batch.length;
    }

    // Small delay between batches to respect rate limits
    if (i + BATCH_SIZE < tools.length) {
      await sleep(500);
    }
  }

  console.log(`\n========================================`);
  console.log(`DONE: ${successCount} succeeded, ${failCount} failed out of ${tools.length} tools.`);
  console.log(`========================================`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
