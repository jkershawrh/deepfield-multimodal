import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import { MetricCard } from './MetricCard';

interface PlatformData {
  timestamp: string;
  inference: {
    models: Record<string, {
      replicas: number;
      latency_p50_ms: number;
      latency_p95_ms: number;
      throughput_rps: number;
      status: string;
    }>;
  } | null;
  classification: {
    total_classifications: number;
    agents: Record<string, { count: number; avg_confidence: number }>;
  } | null;
  governance: {
    total_cycles: number;
    committed: number;
    rejected: number;
    action_distribution: Record<string, number>;
  } | null;
  fleet: {
    clusters: number;
    pools: number;
    tenants: number;
    routing?: { semantic_tiers: Record<string, number> };
  } | null;
  ledger: {
    total_entries: number;
    gcl_entries: number;
    chains_valid: boolean;
  } | null;
}

interface Props {
  onExit: () => void;
}

const POLL_INTERVAL = 15_000;

const ACTION_COLORS: Record<string, string> = {
  no_action: 'var(--text-dim)',
  scale: 'var(--rh-blue)',
  pre_warm: 'var(--rh-teal)',
  shed_load: 'var(--rh-orange)',
  alert: 'var(--rh-yellow)',
  migrate: 'var(--rh-purple)',
};

const cardSpring = { type: 'spring' as const, stiffness: 400, damping: 25 };

export default function PlatformDashboard({ onExit }: Props) {
  const [data, setData] = useState<PlatformData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const baseUrl =
      (window as unknown as Record<string, string>).__FLEET_CONTROLLER_URL__ || '';
    const url = baseUrl
      ? `${baseUrl}/api/v1/metrics/platform`
      : '/api/v1/metrics/platform';
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as PlatformData;
      setData(json);
      setError(null);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fetch failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  // Helpers to pull first model from inference map
  const firstModel = data?.inference?.models
    ? Object.values(data.inference.models)[0]
    : null;

  const commitRate =
    data?.governance && data.governance.total_cycles > 0
      ? ((data.governance.committed / data.governance.total_cycles) * 100).toFixed(1)
      : null;

  const semanticTotal =
    data?.fleet?.routing?.semantic_tiers
      ? Object.values(data.fleet.routing.semantic_tiers).reduce((a, b) => a + b, 0)
      : 0;

  const semanticPct = (tier: string) => {
    if (!data?.fleet?.routing?.semantic_tiers || semanticTotal === 0) return '---';
    const count = data.fleet.routing.semantic_tiers[tier] ?? 0;
    return `${((count / semanticTotal) * 100).toFixed(1)}%`;
  };

  const nanoAgent = data?.classification?.agents
    ? Object.entries(data.classification.agents).find(([k]) =>
        k.toLowerCase().includes('nano'),
      )
    : null;
  const microAgent = data?.classification?.agents
    ? Object.entries(data.classification.agents).find(([k]) =>
        k.toLowerCase().includes('micro'),
      )
    : null;

  const sectionStyle: React.CSSProperties = {
    marginBottom: 20,
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 10,
    fontFamily: 'Red Hat Mono, monospace',
    fontWeight: 700,
    letterSpacing: 1.5,
    color: 'var(--text-disabled)',
    marginBottom: 8,
  };

  const gridRow = (cols: number): React.CSSProperties => ({
    display: 'grid',
    gridTemplateColumns: `repeat(${cols}, 1fr)`,
    gap: 10,
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: 'var(--bg-dark)',
      }}
    >
      {/* -------- Header bar -------- */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={cardSpring}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 32px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-1)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 700,
              fontFamily: 'Red Hat Display, sans-serif',
            }}
          >
            Platform Overview
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            deepfield-fleet + GCL + fleet-llm-d + ARE Ledger
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Status dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <motion.div
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: error ? 'var(--rh-red)' : 'var(--rh-green)',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {error ? 'Error' : loading ? 'Loading...' : 'Connected'}
            </span>
          </div>

          <button
            onClick={onExit}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              color: 'var(--text-dim)',
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Back
          </button>
        </div>
      </motion.div>

      {/* -------- Main content -------- */}
      <div
        style={{
          flex: 1,
          maxWidth: 1100,
          width: '100%',
          margin: '0 auto',
          padding: '24px 24px',
        }}
      >
        {/* B. Inference Section */}
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>INFERENCE</div>
          <div style={gridRow(4)}>
            <MetricCard
              label="Single Request"
              value={firstModel ? `${firstModel.latency_p50_ms}ms` : '---'}
              color="var(--rh-blue)"
            />
            <MetricCard
              label="P95 Latency"
              value={firstModel ? `${firstModel.latency_p95_ms}ms` : '---'}
              color="var(--rh-blue)"
            />
            <MetricCard
              label="Throughput"
              value={firstModel ? `${firstModel.throughput_rps} rps` : '---'}
              color="var(--rh-blue)"
            />
            <MetricCard
              label="Replicas"
              value={firstModel ? firstModel.replicas : '---'}
              color="var(--rh-blue)"
            />
          </div>
        </div>

        {/* C. Governance Section */}
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>GOVERNANCE</div>
          <div style={gridRow(4)}>
            <MetricCard
              label="Total Cycles"
              value={data?.governance?.total_cycles ?? '---'}
            />
            <MetricCard
              label="Committed"
              value={data?.governance?.committed ?? '---'}
              color="var(--rh-green)"
            />
            <MetricCard
              label="Rejected"
              value={data?.governance?.rejected ?? '---'}
              color="var(--rh-red)"
            />
            <MetricCard
              label="Commit Rate"
              value={commitRate ? `${commitRate}%` : '---'}
              color="var(--rh-green)"
            />
          </div>
        </div>

        {/* D. Classification Section */}
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>CLASSIFICATION</div>
          <div style={gridRow(3)}>
            <MetricCard
              label="Classifications"
              value={data?.classification?.total_classifications ?? '---'}
              color="var(--rh-teal)"
            />
            <MetricCard
              label="Nano"
              value={nanoAgent ? nanoAgent[1].count : '---'}
              color="var(--rh-blue)"
              detail={
                nanoAgent
                  ? `avg conf ${(nanoAgent[1].avg_confidence * 100).toFixed(0)}%`
                  : undefined
              }
            />
            <MetricCard
              label="Micro"
              value={microAgent ? microAgent[1].count : '---'}
              color="var(--rh-green)"
              detail={
                microAgent
                  ? `avg conf ${(microAgent[1].avg_confidence * 100).toFixed(0)}%`
                  : undefined
              }
            />
          </div>
        </div>

        {/* E. Fleet Section */}
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>FLEET</div>
          <div style={gridRow(3)}>
            <MetricCard
              label="Clusters"
              value={data?.fleet?.clusters ?? '---'}
              color="var(--rh-orange)"
            />
            <MetricCard
              label="Pools"
              value={data?.fleet?.pools ?? '---'}
              color="var(--rh-orange)"
            />
            <MetricCard
              label="Tenants"
              value={data?.fleet?.tenants ?? '---'}
              color="var(--rh-orange)"
            />
          </div>
        </div>

        {/* F. Semantic Routing Section */}
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>SEMANTIC ROUTING</div>
          <div style={gridRow(3)}>
            <MetricCard
              label="Simple"
              value={semanticPct('simple')}
              color="var(--rh-blue)"
            />
            <MetricCard
              label="Standard"
              value={semanticPct('standard')}
              color="var(--rh-orange)"
            />
            <MetricCard
              label="Complex"
              value={semanticPct('complex')}
              color="var(--rh-purple)"
            />
          </div>
        </div>

        {/* G. Ledger Section */}
        <div style={sectionStyle}>
          <div style={sectionLabelStyle}>LEDGER</div>
          <div style={gridRow(3)}>
            <MetricCard
              label="Total Entries"
              value={data?.ledger?.total_entries ?? '---'}
            />
            <MetricCard
              label="GCL Entries"
              value={data?.ledger?.gcl_entries ?? '---'}
              color="var(--rh-teal)"
            />
            <MetricCard
              label="Chains Valid"
              value={
                data?.ledger != null
                  ? data.ledger.chains_valid
                    ? 'Yes'
                    : 'No'
                  : '---'
              }
              color={
                data?.ledger != null
                  ? data.ledger.chains_valid
                    ? 'var(--rh-green)'
                    : 'var(--rh-red)'
                  : undefined
              }
            />
          </div>
        </div>

        {/* H. Action Distribution */}
        {data?.governance?.action_distribution && (
          <div style={sectionStyle}>
            <div style={sectionLabelStyle}>ACTION DISTRIBUTION</div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={cardSpring}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                padding: 16,
                background: 'var(--surface-1)',
                border: '1px solid var(--border)',
                borderRadius: 10,
              }}
            >
              {Object.entries(data.governance.action_distribution).map(
                ([action, count]) => (
                  <span
                    key={action}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      borderRadius: 20,
                      fontSize: 12,
                      fontFamily: 'Red Hat Mono, monospace',
                      background: `${ACTION_COLORS[action] || 'var(--text-dim)'}18`,
                      border: `1px solid ${ACTION_COLORS[action] || 'var(--text-dim)'}40`,
                      color: ACTION_COLORS[action] || 'var(--text-dim)',
                      fontWeight: 600,
                    }}
                  >
                    {action.replace(/_/g, ' ')}
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: 14,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {count}
                    </span>
                  </span>
                ),
              )}
            </motion.div>
          </div>
        )}

        {/* I. Refresh + last-updated */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              background: 'var(--rh-teal)',
              border: 'none',
              color: '#fff',
              padding: '8px 24px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          {lastUpdated && (
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-disabled)',
                fontFamily: 'Red Hat Mono, monospace',
              }}
            >
              Last updated: {lastUpdated}
            </span>
          )}
        </div>

        {/* Error banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              marginTop: 12,
              padding: '10px 16px',
              background: 'var(--rh-red)18',
              border: '1px solid var(--rh-red)40',
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--rh-red)',
              fontFamily: 'Red Hat Mono, monospace',
            }}
          >
            Could not reach platform endpoint: {error}
          </motion.div>
        )}
      </div>
    </div>
  );
}
