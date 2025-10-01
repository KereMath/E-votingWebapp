import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface KeyGenDisplayProps {
  pollId: number;
}

interface MvkData {
  alpha2: string;
  beta2: string;
  beta1: string;
  threshold: number;
  total_authorities: number;
  generated_at: string;
}

const KeyGenDisplay: React.FC<KeyGenDisplayProps> = ({ pollId }) => {
  const [mvk, setMvk] = useState<MvkData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchMvk = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await axios.get(`http://localhost:8000/polls/${pollId}/mvk`);
      setMvk(response.data.mvk);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('KeyGen not completed yet');
      } else {
        setError('Failed to fetch master verification key');
      }
      setMvk(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMvk();
  }, [pollId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    alert(`${label} copied to clipboard!`);
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
        <p>Loading master verification key...</p>
      </div>
    );
  }

  if (error || !mvk) {
    return (
      <div style={{ 
        padding: '20px', 
        backgroundColor: '#ff444411',
        borderRadius: '8px',
        border: '1px solid #ff4444',
        marginTop: '20px'
      }}>
        <p style={{ color: '#ff6666', margin: 0 }}>{error || 'No data available'}</p>
      </div>
    );
  }

  return (
    <div style={{
      border: '2px solid #ff6b6b',
      borderRadius: '8px',
      padding: '25px',
      backgroundColor: '#2a1a1a',
      marginTop: '20px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <div>
          <h3 style={{ margin: '0 0 8px 0', color: '#ff6b6b', fontSize: '18px' }}>
            Master Verification Key (MVK)
          </h3>
          <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>
            Broadcast to all participants | Threshold: {mvk.threshold}/{mvk.total_authorities}
          </p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            padding: '8px 16px',
            backgroundColor: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {expanded && (
        <div>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <strong style={{ fontSize: '13px' }}>α₂ (alpha2)</strong>
              <button
                onClick={() => copyToClipboard(mvk.alpha2, 'Alpha2')}
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                Copy
              </button>
            </div>
            <div style={{
              backgroundColor: '#0a0a0a',
              padding: '10px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '10px',
              wordBreak: 'break-all',
              color: '#ff6b6b'
            }}>
              {mvk.alpha2.substring(0, 50)}...
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <strong style={{ fontSize: '13px' }}>β₂ (beta2)</strong>
              <button
                onClick={() => copyToClipboard(mvk.beta2, 'Beta2')}
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                Copy
              </button>
            </div>
            <div style={{
              backgroundColor: '#0a0a0a',
              padding: '10px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '10px',
              wordBreak: 'break-all',
              color: '#ff6b6b'
            }}>
              {mvk.beta2.substring(0, 50)}...
            </div>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
              <strong style={{ fontSize: '13px' }}>β₁ (beta1)</strong>
              <button
                onClick={() => copyToClipboard(mvk.beta1, 'Beta1')}
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                Copy
              </button>
            </div>
            <div style={{
              backgroundColor: '#0a0a0a',
              padding: '10px',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '10px',
              wordBreak: 'break-all',
              color: '#ff6b6b'
            }}>
              {mvk.beta1.substring(0, 50)}...
            </div>
          </div>

          <div style={{
            marginTop: '20px',
            padding: '15px',
            backgroundColor: '#3a2a2a',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#aaa'
          }}>
            <strong>Algorithm 2 Output:</strong>
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              <li>MVK = (α₂, β₂, β₁) where α₂ = g₂ˣ, β₂ = g₂ʸ, β₁ = g₁ʸ</li>
              <li>Secret keys distributed to {mvk.total_authorities} authorities</li>
              <li>Threshold t = {mvk.threshold} (minimum signatures required)</li>
              <li>Generated: {new Date(mvk.generated_at).toLocaleString()}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyGenDisplay;