import React, { useState } from 'react';

// Mock WASM functions - These will be replaced with real WASM calls later
const mockWasmFunctions = {
  generateDid: async (userId: string): Promise<string> => {
    console.log(`[WASM Mock] Generating DID for user: ${userId}`);
    return new Promise(resolve => 
      setTimeout(() => resolve(`did:example:${Date.now()}`), 1000)
    );
  },
  prepareBlindSign: async (did: string): Promise<{ com: string; pi_s: string }> => {
    console.log(`[WASM Mock] Preparing blind sign for DID: ${did}`);
    return new Promise(resolve => 
      setTimeout(() => resolve({ 
        com: 'commitment_' + Math.random().toString(36).substring(7), 
        pi_s: 'proof_' + Math.random().toString(36).substring(7)
      }), 1500)
    );
  },
};

interface VoterPanelProps {
  token: string;
  voterEmail: string;
}

const VoterPanel: React.FC<VoterPanelProps> = ({ token, voterEmail }) => {
  const [did, setDid] = useState<string | null>(null);
  const [blindSignRequest, setBlindSignRequest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const handleGenerateDid = async () => {
    setIsLoading(true);
    try {
      const generatedDid = await mockWasmFunctions.generateDid(voterEmail);
      setDid(generatedDid);
      setCurrentStep(2);
    } catch (error) {
      console.error('Error generating DID:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrepareSign = async () => {
    if (!did) return;
    setIsLoading(true);
    try {
      const request = await mockWasmFunctions.prepareBlindSign(did);
      setBlindSignRequest(request);
      setCurrentStep(3);
    } catch (error) {
      console.error('Error preparing blind sign:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      marginTop: '40px', 
      borderTop: '2px solid #555', 
      paddingTop: '30px',
      maxWidth: '800px',
      margin: '40px auto 0'
    }}>
      <h2>Voter Panel - Client-Side Cryptography</h2>
      <p style={{ color: '#888', fontSize: '14px' }}>
        All cryptographic operations happen on your browser for maximum privacy.
      </p>

      {/* Step 1: Generate DID */}
      <div style={{ 
        padding: '20px', 
        marginTop: '20px', 
        border: currentStep === 1 ? '2px solid #646cff' : '1px solid #444',
        borderRadius: '8px',
        backgroundColor: currentStep === 1 ? '#646cff11' : 'transparent'
      }}>
        <h3>Step 1: Generate Decentralized Identity (DID)</h3>
        <p style={{ fontSize: '14px', color: '#aaa' }}>
          Your unique identifier for anonymous voting
        </p>
        
        <button 
          onClick={handleGenerateDid} 
          disabled={isLoading || did !== null}
          style={{ marginTop: '10px' }}
        >
          {isLoading && currentStep === 1 ? 'Generating...' : did ? '✓ DID Generated' : 'Generate DID'}
        </button>
        
        {did && (
          <div style={{ 
            marginTop: '15px', 
            padding: '10px', 
            backgroundColor: '#44ff4411', 
            borderRadius: '4px',
            wordBreak: 'break-all'
          }}>
            <strong>Your DID:</strong> {did}
          </div>
        )}
      </div>

      {/* Step 2: Prepare Blind Signature */}
      <div style={{ 
        padding: '20px', 
        marginTop: '20px', 
        border: currentStep === 2 ? '2px solid #646cff' : '1px solid #444',
        borderRadius: '8px',
        backgroundColor: currentStep === 2 ? '#646cff11' : 'transparent',
        opacity: did ? 1 : 0.5
      }}>
        <h3>Step 2: Request Blind Signature</h3>
        <p style={{ fontSize: '14px', color: '#aaa' }}>
          Prepare cryptographic proof for anonymous authentication
        </p>
        
        <button 
          onClick={handlePrepareSign} 
          disabled={!did || isLoading || blindSignRequest !== null}
          style={{ marginTop: '10px' }}
        >
          {isLoading && currentStep === 2 ? 'Preparing...' : blindSignRequest ? '✓ Request Prepared' : 'Prepare Blind Sign Request'}
        </button>
        
        {blindSignRequest && (
          <div style={{ 
            marginTop: '15px', 
            padding: '15px', 
            backgroundColor: '#2a2a2a', 
            borderRadius: '4px',
            textAlign: 'left'
          }}>
            <strong>Blind Signature Request:</strong>
            <pre style={{ 
              fontSize: '12px', 
              overflow: 'auto',
              marginTop: '10px'
            }}>
              {JSON.stringify(blindSignRequest, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Step 3: Vote (Future) */}
      <div style={{ 
        padding: '20px', 
        marginTop: '20px', 
        border: currentStep === 3 ? '2px solid #646cff' : '1px solid #444',
        borderRadius: '8px',
        backgroundColor: currentStep === 3 ? '#646cff11' : 'transparent',
        opacity: blindSignRequest ? 1 : 0.5
      }}>
        <h3>Step 3: Cast Your Vote</h3>
        <p style={{ fontSize: '14px', color: '#aaa' }}>
          Submit your anonymous, verifiable vote
        </p>
        
        <button 
          disabled={!blindSignRequest}
          style={{ marginTop: '10px' }}
        >
          Cast Vote (Coming Soon)
        </button>
        
        {blindSignRequest && (
          <p style={{ 
            marginTop: '15px', 
            padding: '10px', 
            backgroundColor: '#ff44441a', 
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            ⚠️ Voting functionality will be implemented after backend integration
          </p>
        )}
      </div>

      {isLoading && (
        <div style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: '#646cff22',
          borderRadius: '4px'
        }}>
          <i>🔐 Performing cryptographic operations...</i>
        </div>
      )}
    </div>
  );
};

export default VoterPanel;