export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

type Policy = {
  min_independent_sources?: number;
  min_support_percent?: number;
  max_conflict_percent?: number;
};

type RequestBody = {
  claim?: string;
  sources?: string[];
  policy?: Policy;
};

type GenLayerClient = any;

const MIN_SOURCES = 2;
const MAX_SOURCES = 5;
const MAX_CLAIM_CHARS = 600;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RequestBody;
    const claim = normalizeClaim(body.claim);
    const sources = normalizeSources(body.sources);
    const policy = normalizePolicy(body.policy);

    const contractAddress = mustEnv('GENLAYER_CONTRACT_ADDRESS');
    const endpoint =
      process.env.GENLAYER_ENDPOINT?.trim() || 'https://studio.genlayer.com/api';

    const client = await createGenLayerClient(endpoint);
    const result = await callGenLayer(client, contractAddress, claim, sources, policy);

    return NextResponse.json({
      result,
      contract_address: contractAddress,
      source_count: sources.length,
      policy,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

function normalizeClaim(value: unknown) {
  if (typeof value !== 'string') throw new Error('Claim is required');
  const claim = value.trim();
  if (claim.length < 8) throw new Error('Claim is too short');
  if (claim.length > MAX_CLAIM_CHARS) throw new Error('Claim is too long');
  return claim;
}

function normalizeSources(value: unknown) {
  if (!Array.isArray(value)) throw new Error('Sources must be an array');
  if (value.length < MIN_SOURCES || value.length > MAX_SOURCES) {
    throw new Error('Provide between 2 and 5 source URLs');
  }

  const seen = new Set<string>();
  return value.map((item, index) => {
    if (typeof item !== 'string') throw new Error(`Source ${index + 1} is invalid`);
    const url = item.trim();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error(`Source ${index + 1} is not a valid URL`);
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Source ${index + 1} must use http or https`);
    }
    const key = url.toLowerCase();
    if (seen.has(key)) throw new Error('Duplicate source URLs are not allowed');
    seen.add(key);
    return url;
  });
}

function normalizePolicy(value: Policy | undefined) {
  const minIndependent = integerInRange(
    value?.min_independent_sources ?? 2,
    2,
    5,
    'Minimum independent sources',
  );
  const minSupport = integerInRange(
    value?.min_support_percent ?? 66,
    51,
    100,
    'Minimum support percent',
  );
  const maxConflict = integerInRange(
    value?.max_conflict_percent ?? 34,
    0,
    49,
    'Maximum conflict percent',
  );

  return {
    min_independent_sources: minIndependent,
    min_support_percent: minSupport,
    max_conflict_percent: maxConflict,
  };
}

function integerInRange(value: unknown, min: number, max: number, label: string) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${label} must be an integer from ${min} to ${max}`);
  }
  return n;
}

async function createGenLayerClient(endpoint: string): Promise<GenLayerClient> {
  const mod = await import('genlayer-js');
  return mod.createClient({ endpoint });
}

async function callGenLayer(
  client: GenLayerClient,
  contractAddress: string,
  claim: string,
  sources: string[],
  policy: ReturnType<typeof normalizePolicy>,
) {
  const args = [claim, JSON.stringify(sources), JSON.stringify(policy)];

  // Same proven server-route pattern used by GitJudge: prefer simulation so the
  // public Vercel demo does not need to hold or expose a signing key.
  if (typeof client.simulateWriteContract === 'function') {
    const simulated = await client.simulateWriteContract({
      address: contractAddress as `0x${string}`,
      functionName: 'analyze',
      args,
    });
    return normalizeResult(simulated?.result ?? simulated?.data ?? simulated ?? null);
  }

  if (typeof client.writeContract === 'function') {
    const txHash = await client.writeContract({
      address: contractAddress as `0x${string}`,
      functionName: 'analyze',
      args,
    });
    return {
      txHash,
      warning:
        'writeContract completed, but this server route does not wait for a receipt. Prefer a GenLayer version exposing simulateWriteContract for the public demo.',
    };
  }

  throw new Error('GenLayer client does not expose simulateWriteContract or writeContract');
}

function normalizeResult(value: unknown) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return { raw: value };
    }
  }
  return value;
}

function mustEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}
