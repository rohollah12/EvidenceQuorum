'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';

type Status =
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'DISPUTED'
  | 'INSUFFICIENT_EVIDENCE'
  | string;

type SourceResult = {
  index?: number;
  url?: string;
  domain?: string;
  accessible?: boolean;
  relevant?: boolean;
  stance?: 'SUPPORTS' | 'CONTRADICTS' | 'NEUTRAL' | string;
  origin_key?: string;
  reason?: string;
};

type EvidenceGroup = {
  origin_key?: string;
  indices?: number[];
  vote?: string;
};

type AnalysisResult = {
  status?: Status;
  claim?: string;
  summary?: string;
  policy?: {
    min_independent_sources?: number;
    min_support_percent?: number;
    max_conflict_percent?: number;
  };
  metrics?: {
    submitted_sources?: number;
    accessible_sources?: number;
    relevant_sources?: number;
    independent_groups?: number;
    decisive_independent_groups?: number;
    supporting_independent_groups?: number;
    contradicting_independent_groups?: number;
    neutral_independent_groups?: number;
    support_percent?: number;
    conflict_percent?: number;
  };
  sources?: SourceResult[];
  groups?: EvidenceGroup[];
  txHash?: string;
  warning?: string;
  raw?: unknown;
};

type ApiResponse = {
  result?: AnalysisResult;
  contract_address?: string;
  source_count?: number;
  error?: string;
};

const DEMO_CLAIM = 'Python was created by Guido van Rossum.';
const DEMO_SOURCES = [
  'https://www.python.org/doc/essays/foreword/',
  'https://www.britannica.com/technology/Python-computer-language',
  'https://en.wikipedia.org/wiki/Python_(programming_language)',
];

export default function Page() {
  const [claim, setClaim] = useState(DEMO_CLAIM);
  const [sources, setSources] = useState<string[]>(DEMO_SOURCES);
  const [minIndependent, setMinIndependent] = useState(2);
  const [minSupport, setMinSupport] = useState(66);
  const [maxConflict, setMaxConflict] = useState(34);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [contractAddress, setContractAddress] = useState('');
  const [error, setError] = useState('');

  const canAnalyze = useMemo(() => {
    const usableSources = sources.filter((s) => s.trim()).length;
    return claim.trim().length >= 8 && usableSources >= 2 && !loading;
  }, [claim, sources, loading]);

  function updateSource(index: number, value: string) {
    setSources((current) => current.map((source, i) => (i === index ? value : source)));
  }

  function addSource() {
    if (sources.length < 5) setSources((current) => [...current, '']);
  }

  function removeSource(index: number) {
    if (sources.length <= 2) return;
    setSources((current) => current.filter((_, i) => i !== index));
  }

  function loadDemo() {
    setClaim(DEMO_CLAIM);
    setSources(DEMO_SOURCES);
    setMinIndependent(2);
    setMinSupport(66);
    setMaxConflict(34);
    setResult(null);
    setError('');
  }

  async function handleAnalyze() {
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim,
          sources: sources.map((s) => s.trim()).filter(Boolean),
          policy: {
            min_independent_sources: minIndependent,
            min_support_percent: minSupport,
            max_conflict_percent: maxConflict,
          },
        }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok) throw new Error(data.error ?? 'Analysis failed');
      setResult(data.result ?? null);
      setContractAddress(data.contract_address ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const metrics = result?.metrics;

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div style={pillStyle}>EvidenceQuorum · GenLayer Intelligent Contract</div>
        <h1 style={titleStyle}>Independent evidence, not duplicate links.</h1>
        <p style={subtitleStyle}>
          Submit a claim and 2–5 web sources. The contract reads each source, identifies
          whether it supports or contradicts the claim, collapses syndicated or derivative
          reporting into a single evidence origin, then applies an explicit quorum policy.
        </p>
      </section>

      <section style={cardStyle}>
        <div style={sectionHeaderRowStyle}>
          <div>
            <div style={sectionLabelStyle}>Claim</div>
            <div style={smallMutedStyle}>A bounded proposition that the evidence can address.</div>
          </div>
          <button type="button" onClick={loadDemo} style={secondaryButtonStyle}>
            Load demo
          </button>
        </div>
        <textarea
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          rows={3}
          maxLength={600}
          placeholder="Example: Company X completed the announced acquisition of Company Y."
          style={textareaStyle}
        />

        <div style={sectionHeaderRowStyle}>
          <div>
            <div style={sectionLabelStyle}>Evidence sources</div>
            <div style={smallMutedStyle}>Different URLs can still collapse to one origin.</div>
          </div>
          <button
            type="button"
            onClick={addSource}
            disabled={sources.length >= 5}
            style={secondaryButtonStyle}
          >
            + Add source
          </button>
        </div>

        <div style={sourceInputListStyle}>
          {sources.map((source, index) => (
            <div key={`source-${index}`} style={sourceInputRowStyle}>
              <div style={sourceNumberStyle}>{index + 1}</div>
              <input
                value={source}
                onChange={(e) => updateSource(index, e.target.value)}
                placeholder="https://example.com/evidence"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => removeSource(index)}
                disabled={sources.length <= 2}
                aria-label={`Remove source ${index + 1}`}
                style={removeButtonStyle(sources.length > 2)}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div style={policyGridStyle}>
          <NumberField
            label="Min independent sources"
            value={minIndependent}
            min={2}
            max={5}
            onChange={setMinIndependent}
          />
          <NumberField
            label="Min support %"
            value={minSupport}
            min={51}
            max={100}
            onChange={setMinSupport}
          />
          <NumberField
            label="Max conflict %"
            value={maxConflict}
            min={0}
            max={49}
            onChange={setMaxConflict}
          />
        </div>

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!canAnalyze}
          style={primaryButtonStyle(canAnalyze)}
        >
          {loading ? 'Analyzing evidence with GenLayer…' : 'Analyze with EvidenceQuorum'}
        </button>

        <p style={hintStyle}>
          The Vercel route only forwards your claim, URLs, and quorum policy. Web retrieval,
          evidence classification, source-origin grouping, and consensus validation happen in
          the GenLayer contract.
        </p>
      </section>

      {error ? <div style={errorStyle}>{error}</div> : null}

      {result ? (
        <section style={resultsStyle}>
          <div style={metricGridStyle}>
            <MetricCard label="Outcome" value={result.status ?? '—'} accent />
            <MetricCard
              label="Independent evidence"
              value={`${metrics?.decisive_independent_groups ?? '—'}`}
              detail={`of ${metrics?.independent_groups ?? '—'} relevant origin groups`}
            />
            <MetricCard
              label="Support"
              value={
                typeof metrics?.support_percent === 'number'
                  ? `${metrics.support_percent}%`
                  : '—'
              }
              detail={`${metrics?.supporting_independent_groups ?? '—'} supporting groups`}
            />
            <MetricCard
              label="Conflict"
              value={
                typeof metrics?.conflict_percent === 'number'
                  ? `${metrics.conflict_percent}%`
                  : '—'
              }
              detail={`${metrics?.contradicting_independent_groups ?? '—'} contradicting groups`}
            />
          </div>

          <div style={wideCardStyle}>
            <div style={sectionLabelStyle}>Consensus summary</div>
            <p style={bodyTextStyle}>{result.summary || 'No summary returned.'}</p>
          </div>

          <div style={wideCardStyle}>
            <div style={sectionLabelStyle}>Independent origin groups</div>
            {result.groups?.length ? (
              <div style={groupListStyle}>
                {result.groups.map((group, index) => (
                  <div key={`${group.origin_key}-${index}`} style={groupRowStyle}>
                    <span style={originStyle}>{group.origin_key || 'unknown'}</span>
                    <span style={stanceBadgeStyle(group.vote)}>{group.vote || 'NEUTRAL'}</span>
                    <span style={smallMutedStyle}>
                      source{(group.indices?.length ?? 0) === 1 ? '' : 's'}:{' '}
                      {(group.indices ?? []).map((i) => i + 1).join(', ') || '—'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={smallMutedStyle}>No relevant evidence groups were formed.</p>
            )}
          </div>

          <div style={wideCardStyle}>
            <div style={sectionLabelStyle}>Source analysis</div>
            <div style={sourceResultListStyle}>
              {(result.sources ?? []).map((source, index) => (
                <article key={`${source.url}-${index}`} style={sourceResultStyle}>
                  <div style={sourceResultTopStyle}>
                    <div>
                      <div style={sourceTitleStyle}>
                        Source {index + 1} · {source.domain || 'unknown domain'}
                      </div>
                      <div style={urlStyle}>{source.url || '—'}</div>
                    </div>
                    <span style={stanceBadgeStyle(source.stance)}>{source.stance ?? 'NEUTRAL'}</span>
                  </div>
                  <div style={sourceMetaStyle}>
                    <span>
                      Origin: <strong>{source.origin_key || 'unknown'}</strong>
                    </span>
                    <span>Relevant: {source.relevant ? 'yes' : 'no'}</span>
                    <span>Accessible: {source.accessible ? 'yes' : 'no'}</span>
                  </div>
                  <p style={sourceReasonStyle}>{source.reason || 'No reason returned.'}</p>
                </article>
              ))}
            </div>
          </div>

          <div style={twoColumnStyle}>
            <div style={resultCardStyle}>
              <div style={sectionLabelStyle}>Applied policy</div>
              <p style={bodyTextStyle}>
                ≥ {result.policy?.min_independent_sources ?? minIndependent} independent decisive
                sources
                <br />≥ {result.policy?.min_support_percent ?? minSupport}% support
                <br />≤ {result.policy?.max_conflict_percent ?? maxConflict}% conflict
              </p>
            </div>
            <div style={resultCardStyle}>
              <div style={sectionLabelStyle}>Contract</div>
              <p style={addressStyle}>{contractAddress || 'Configured server-side'}</p>
              <p style={smallMutedStyle}>
                The public demo uses simulateWriteContract, matching the deployment pattern used by
                GitJudge, so no private key is stored in Vercel.
              </p>
            </div>
          </div>

          {result.warning ? <div style={warningStyle}>{result.warning}</div> : null}

          <details style={detailsStyle}>
            <summary style={summaryStyle}>Raw contract response</summary>
            <pre style={preStyle}>{JSON.stringify(result, null, 2)}</pre>
          </details>
        </section>
      ) : null}
    </main>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={numberFieldStyle}>
      <span style={fieldLabelStyle}>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        style={numberInputStyle}
      />
      <span style={smallMutedStyle}>
        range {min}–{max}
      </span>
    </label>
  );
}

function MetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <div style={metricCardStyle}>
      <div style={metricLabelStyle}>{label}</div>
      <div style={metricValueStyle(accent)}>{value}</div>
      {detail ? <div style={smallMutedStyle}>{detail}</div> : null}
    </div>
  );
}

const pageStyle: CSSProperties = {
  maxWidth: 1080,
  margin: '0 auto',
  padding: '42px 20px 80px',
};

const heroStyle: CSSProperties = { display: 'grid', gap: 14, marginBottom: 26 };
const pillStyle: CSSProperties = {
  display: 'inline-flex',
  width: 'fit-content',
  padding: '8px 12px',
  borderRadius: 999,
  border: '1px solid rgba(110, 231, 183, 0.24)',
  background: 'rgba(6, 78, 59, 0.22)',
  color: '#a7f3d0',
  fontWeight: 800,
  fontSize: 13,
};
const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: 'clamp(38px, 7vw, 66px)',
  lineHeight: 1,
  letterSpacing: -2,
  maxWidth: 900,
};
const subtitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: 900,
  color: '#b8d7cc',
  fontSize: 18,
  lineHeight: 1.65,
};
const cardStyle: CSSProperties = {
  display: 'grid',
  gap: 18,
  padding: 22,
  borderRadius: 26,
  border: '1px solid rgba(167, 243, 208, 0.14)',
  background: 'rgba(5, 20, 17, 0.88)',
  boxShadow: '0 30px 100px rgba(0, 0, 0, 0.32)',
};
const sectionHeaderRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  flexWrap: 'wrap',
};
const sectionLabelStyle: CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: 1,
  color: '#6ee7b7',
  fontSize: 13,
  fontWeight: 800,
  marginBottom: 6,
};
const smallMutedStyle: CSSProperties = { color: '#86a99d', fontSize: 13, lineHeight: 1.5 };
const textareaStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  resize: 'vertical',
  border: '1px solid rgba(167, 243, 208, 0.18)',
  borderRadius: 16,
  padding: '14px 16px',
  background: 'rgba(8, 31, 26, 0.9)',
  color: '#e7f5ef',
  font: 'inherit',
  lineHeight: 1.55,
  outline: 'none',
};
const sourceInputListStyle: CSSProperties = { display: 'grid', gap: 10 };
const sourceInputRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '34px minmax(0, 1fr) 38px',
  gap: 10,
  alignItems: 'center',
};
const sourceNumberStyle: CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 10,
  display: 'grid',
  placeItems: 'center',
  background: 'rgba(16, 185, 129, 0.12)',
  color: '#a7f3d0',
  fontWeight: 800,
};
const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid rgba(167, 243, 208, 0.16)',
  borderRadius: 14,
  padding: '12px 14px',
  background: 'rgba(8, 31, 26, 0.9)',
  color: '#e7f5ef',
  outline: 'none',
};
const removeButtonStyle = (enabled: boolean): CSSProperties => ({
  height: 36,
  borderRadius: 10,
  border: '1px solid rgba(248, 113, 113, 0.2)',
  background: enabled ? 'rgba(127, 29, 29, 0.28)' : 'rgba(51, 65, 85, 0.2)',
  color: enabled ? '#fecaca' : '#64748b',
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontSize: 21,
});
const secondaryButtonStyle: CSSProperties = {
  border: '1px solid rgba(167, 243, 208, 0.2)',
  borderRadius: 12,
  padding: '9px 12px',
  background: 'rgba(6, 78, 59, 0.24)',
  color: '#d1fae5',
  cursor: 'pointer',
  fontWeight: 700,
};
const policyGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
  gap: 12,
};
const numberFieldStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
  padding: 14,
  borderRadius: 16,
  border: '1px solid rgba(167, 243, 208, 0.12)',
  background: 'rgba(8, 31, 26, 0.58)',
};
const fieldLabelStyle: CSSProperties = { fontSize: 13, fontWeight: 800, color: '#d1fae5' };
const numberInputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid rgba(167, 243, 208, 0.16)',
  borderRadius: 12,
  padding: '10px 12px',
  background: '#071a16',
  color: '#f0fdf4',
  fontWeight: 800,
};
const primaryButtonStyle = (enabled: boolean): CSSProperties => ({
  border: 'none',
  borderRadius: 16,
  padding: '15px 18px',
  fontWeight: 900,
  color: enabled ? '#022c22' : '#94a3b8',
  cursor: enabled ? 'pointer' : 'not-allowed',
  background: enabled ? 'linear-gradient(135deg, #6ee7b7 0%, #34d399 100%)' : '#334155',
  boxShadow: enabled ? '0 16px 38px rgba(16, 185, 129, 0.18)' : 'none',
});
const hintStyle: CSSProperties = { margin: 0, color: '#86a99d', lineHeight: 1.6, fontSize: 14 };
const errorStyle: CSSProperties = {
  marginTop: 18,
  padding: 16,
  borderRadius: 16,
  border: '1px solid rgba(248, 113, 113, 0.3)',
  background: 'rgba(127, 29, 29, 0.34)',
  color: '#fecaca',
};
const resultsStyle: CSSProperties = { display: 'grid', gap: 16, marginTop: 20 };
const metricGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
};
const metricCardStyle: CSSProperties = {
  padding: 17,
  borderRadius: 20,
  border: '1px solid rgba(167, 243, 208, 0.13)',
  background: 'rgba(8, 31, 26, 0.76)',
};
const metricLabelStyle: CSSProperties = {
  color: '#86a99d',
  fontSize: 12,
  textTransform: 'uppercase',
  letterSpacing: 1,
  marginBottom: 8,
};
const metricValueStyle = (accent?: boolean): CSSProperties => ({
  fontSize: accent ? 25 : 30,
  lineHeight: 1.1,
  fontWeight: 900,
  color: accent ? '#6ee7b7' : '#f0fdf4',
  wordBreak: 'break-word',
  marginBottom: 5,
});
const wideCardStyle: CSSProperties = {
  padding: 18,
  borderRadius: 20,
  border: '1px solid rgba(167, 243, 208, 0.13)',
  background: 'rgba(8, 31, 26, 0.76)',
};
const resultCardStyle: CSSProperties = {
  padding: 18,
  borderRadius: 20,
  border: '1px solid rgba(167, 243, 208, 0.13)',
  background: 'rgba(8, 31, 26, 0.76)',
};
const bodyTextStyle: CSSProperties = { margin: 0, color: '#d7ece4', lineHeight: 1.7 };
const groupListStyle: CSSProperties = { display: 'grid', gap: 9 };
const groupRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 10,
  padding: 11,
  borderRadius: 14,
  background: 'rgba(4, 18, 15, 0.7)',
};
const originStyle: CSSProperties = { color: '#ecfdf5', fontWeight: 800, wordBreak: 'break-all' };
const stanceBadgeStyle = (stance?: string): CSSProperties => ({
  display: 'inline-flex',
  padding: '5px 9px',
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.5,
  color:
    stance === 'SUPPORTS'
      ? '#a7f3d0'
      : stance === 'CONTRADICTS'
        ? '#fecaca'
        : '#cbd5e1',
  background:
    stance === 'SUPPORTS'
      ? 'rgba(6, 95, 70, 0.45)'
      : stance === 'CONTRADICTS'
        ? 'rgba(127, 29, 29, 0.42)'
        : 'rgba(51, 65, 85, 0.48)',
  border:
    stance === 'SUPPORTS'
      ? '1px solid rgba(110, 231, 183, 0.24)'
      : stance === 'CONTRADICTS'
        ? '1px solid rgba(248, 113, 113, 0.22)'
        : '1px solid rgba(148, 163, 184, 0.18)',
});
const sourceResultListStyle: CSSProperties = { display: 'grid', gap: 10 };
const sourceResultStyle: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  border: '1px solid rgba(167, 243, 208, 0.1)',
  background: 'rgba(4, 18, 15, 0.65)',
};
const sourceResultTopStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 12,
  flexWrap: 'wrap',
};
const sourceTitleStyle: CSSProperties = { color: '#ecfdf5', fontWeight: 850, marginBottom: 4 };
const urlStyle: CSSProperties = { color: '#79cdb1', fontSize: 12, wordBreak: 'break-all' };
const sourceMetaStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '7px 16px',
  marginTop: 12,
  color: '#a8c7bc',
  fontSize: 13,
};
const sourceReasonStyle: CSSProperties = { margin: '10px 0 0', color: '#d7ece4', lineHeight: 1.55 };
const twoColumnStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 12,
};
const addressStyle: CSSProperties = {
  margin: '0 0 10px',
  color: '#d1fae5',
  wordBreak: 'break-all',
  lineHeight: 1.55,
};
const warningStyle: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  color: '#fde68a',
  background: 'rgba(120, 53, 15, 0.3)',
  border: '1px solid rgba(251, 191, 36, 0.2)',
};
const detailsStyle: CSSProperties = {
  padding: 16,
  borderRadius: 18,
  border: '1px solid rgba(167, 243, 208, 0.1)',
  background: 'rgba(4, 18, 15, 0.58)',
};
const summaryStyle: CSSProperties = { cursor: 'pointer', color: '#a7f3d0', fontWeight: 800 };
const preStyle: CSSProperties = {
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  color: '#b8d7cc',
  lineHeight: 1.55,
  fontSize: 12,
};
