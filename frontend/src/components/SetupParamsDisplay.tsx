import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface SetupParamsDisplayProps {
  pollId: number;
  autoRefresh?: boolean;
}

interface SetupParams {
  id: number;
  poll_id: number;
  pairing_param: string;
  prime_order: string;
  g1: string;
  g2: string;
  h1: string;
  security_level: number;
  setup_completed_at: string;
  setup_by: number;
}

const SetupParamsDisplay: React.FC<SetupParamsDisplayProps> = ({ 
  pollId, 
  autoRefresh = false 
}) => {
  const [setupParams, setSetupParams] = useState<SetupParams | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true); // Default açık

  const fetchSetupParams = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axios.get(`http://localhost:8000/polls/${pollId}/setup`);
      setSetupParams(response.data.setup);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('Setup not completed yet');
      } else {
        setError('Failed to fetch setup parameters');
      }
      setSetupParams(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSetupParams();
    
    if (autoRefresh) {
      const interval = setInterval(fetchSetupParams, 5000);
      return () => clearInterval(interval);
    }
  }, [pollId, autoRefresh]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
  };

  const exportToJSON = () => {
    if (!setupParams) return;
    const data = JSON.stringify(setupParams, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `poll_${pollId}_setup_params.json`;
    a.click();
  };

  if (isLoading) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        backgroundColor: '#2a2a2a',
        borderRadius: '8px',
        marginTop: '20px'
      }}>
        <p>Loading setup parameters...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#ff444411',
        borderRadius: '8px',
        border: '1px solid #ff4444',
        marginTop: '20px'
      }}>
        <p style={{ color: '#ff6666', margin: 0 }}>{error}</p>
      </div>
    );
  }

  if (!setupParams) {
    return null;
  }

  const ParamDisplay = ({ label, value, symbol }: { label: string; value: string; symbol?: string }) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <strong style={{ fontSize: '14px' }}>
          {label} {symbol && <span style={{ color: '#888' }}>({symbol})</span>}
        </strong>
        <button
          onClick={() => copyToClipboard(value, label)}
          style={{
            padding: '6px 12px',
            fontSize: '12px',
            backgroundColor: '#3a3a3a',
            border: '1px solid #555',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Copy
        </button>
      </div>
      <div style={{
        backgroundColor: '#0a0a0a',
        padding: '15px',
        borderRadius: '4px',
        border: '1px solid #333',
        fontFamily: 'monospace',
        fontSize: '11px',
        wordBreak: 'break-all',
        lineHeight: '1.6',
        color: '#00ff00'
      }}>
        {value}
      </div>
    </div>
  );

  return (
    <div style={{
      border: '2px solid #44ff44',
      borderRadius: '8px',
      padding: '25px',
      backgroundColor: '#1a2a1a',
      marginTop: '20px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '25px',
        paddingBottom: '15px',
        borderBottom: '1px solid #444'
      }}>
        <div>
          <h3 style={{ margin: '0 0 8px 0', color: '#44ff44', fontSize: '20px' }}>
            TIAC Cryptographic Setup Parameters
          </h3>
          <p style={{ margin: 0, fontSize: '13px', color: '#aaa' }}>
            params = (G₁, G₂, Gₜ, p, g₁, g₂, h₁)
          </p>
          <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#888' }}>
            Security Level: {setupParams.security_level} bits | 
            Completed: {new Date(setupParams.setup_completed_at).toLocaleString()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={exportToJSON}
            style={{
              padding: '10px 20px',
              backgroundColor: '#646cff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Export JSON
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            {expanded ? 'Collapse' : 'Expand All'}
          </button>
        </div>
      </div>

      {expanded ? (
        <div>
          <ParamDisplay 
            label="Pairing Parameters" 
            value={setupParams.pairing_param}
            symbol="G₁, G₂, Gₜ"
          />
          
          <ParamDisplay 
            label="Prime Order" 
            value={setupParams.prime_order}
            symbol="p"
          />
          
          <ParamDisplay 
            label="Generator G1" 
            value={setupParams.g1}
            symbol="g₁ ∈ G₁"
          />
          
          <ParamDisplay 
            label="Generator G2" 
            value={setupParams.g2}
            symbol="g₂ ∈ G₂"
          />
          
          <ParamDisplay 
            label="Generator H1" 
            value={setupParams.h1}
            symbol="h₁ ∈ G₁"
          />

          <div style={{
            marginTop: '25px',
            padding: '20px',
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            fontSize: '13px',
            color: '#aaa'
          }}>
            <strong style={{ color: '#fff', fontSize: '14px' }}>TIAC Protocol Information</strong>
            <ul style={{ marginTop: '12px', paddingLeft: '20px', lineHeight: '1.8' }}>
              <li><strong>Type-3 Pairing:</strong> Asymmetric bilinear groups (G₁, G₂, Gₜ)</li>
              <li><strong>p:</strong> {setupParams.security_level}-bit prime order of all groups</li>
              <li><strong>g₁, h₁:</strong> Independent generators in G₁ (used for commitments)</li>
              <li><strong>g₂:</strong> Generator in G₂ (used for verification)</li>
              <li><strong>Pairing Function:</strong> e: G₁ × G₂ → Gₜ</li>
              <li><strong>Security:</strong> Based on Discrete Logarithm and Bilinear Diffie-Hellman assumptions</li>
            </ul>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
          Click "Expand All" to view complete parameters
        </div>
      )}
    </div>
  );
};

export default SetupParamsDisplay;