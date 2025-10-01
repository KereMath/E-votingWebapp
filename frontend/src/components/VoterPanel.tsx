import React, { useState } from 'react';

// Bu fonksiyonlar ileride WASM modülünden gelecek olan gerçek fonksiyonları taklit ediyor.
const mockWasmFunctions = {
  generateDid: async (userId: string): Promise<string> => {
    console.log(`[WASM Mock] Generating DID for user: ${userId}`);
    // Gerçekte burada C++ kodunuz çalışacak.
    return new Promise(resolve => 
      setTimeout(() => resolve(`did:example:${Date.now()}`), 1000)
    );
  },
  prepareBlindSign: async (did: string): Promise<{ com: string; pi_s: string }> => {
    console.log(`[WASM Mock] Preparing blind sign for DID: ${did}`);
    // Gerçekte burada C++ kodunuz çalışacak.
    return new Promise(resolve => 
      setTimeout(() => resolve({ com: 'commitment_value_123', pi_s: 'proof_value_abc' }), 1500)
    );
  },
};

const VoterPanel = () => {
  const [userId, setUserId] = useState('voter-001');
  const [did, setDid] = useState<string | null>(null);
  const [blindSignRequest, setBlindSignRequest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateDid = async () => {
    setIsLoading(true);
    const generatedDid = await mockWasmFunctions.generateDid(userId);
    setDid(generatedDid);
    setIsLoading(false);
  };

  const handlePrepareSign = async () => {
    if (!did) return;
    setIsLoading(true);
    const request = await mockWasmFunctions.prepareBlindSign(did);
    setBlindSignRequest(request);
    setIsLoading(false);
  };

  return (
    <div style={{ marginTop: '40px', borderTop: '1px solid #555', paddingTop: '20px' }}>
      <h2>Voter Panel (Client-Side Crypto)</h2>

      <div>
        <label>User ID: </label>
        <input type="text" value={userId} onChange={e => setUserId(e.target.value)} />
      </div>

      <button onClick={handleGenerateDid} disabled={isLoading}>
        1. Generate DID (on Client)
      </button>
      {did && <p>Generated DID: <strong>{did}</strong></p>}

      <button onClick={handlePrepareSign} disabled={!did || isLoading}>
        2. Prepare Blind Sign Request (on Client)
      </button>
      {blindSignRequest && <pre>{JSON.stringify(blindSignRequest, null, 2)}</pre>}

      {isLoading && <p><i>(WASM is working...)</i></p>}
    </div>
  );
};

export default VoterPanel;