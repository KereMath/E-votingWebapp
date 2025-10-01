import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface AuthorityPanelProps {
  token: string;
  name: string;
  email: string;
}

interface Poll {
  id: number;
  title: string;
  description: string | null;
  status: string;
}

const AuthorityPanel: React.FC<AuthorityPanelProps> = ({ token, name, email }) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/authority/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('Dashboard:', response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      marginTop: '40px', 
      padding: '20px',
      maxWidth: '1000px',
      margin: '40px auto 0'
    }}>
      <div style={{
        padding: '20px',
        backgroundColor: '#2a2a2a',
        borderRadius: '8px',
        marginBottom: '30px',
        border: '2px solid #ff6b6b'
      }}>
        <h2 style={{ margin: '0 0 15px 0', color: '#ff6b6b' }}>Election Authority Dashboard</h2>
        <div style={{ fontSize: '14px', color: '#aaa' }}>
          <p style={{ margin: '5px 0' }}><strong>Name:</strong> {name}</p>
          <p style={{ margin: '5px 0' }}><strong>Email:</strong> {email}</p>
          <p style={{ margin: '15px 0 0 0', fontSize: '13px', color: '#888' }}>
            As an Election Authority, you are responsible for generating cryptographic keys 
            and participating in blind signature operations for voter credentials.
          </p>
        </div>
      </div>

      <div style={{
        padding: '20px',
        backgroundColor: '#2a2a2a',
        borderRadius: '8px'
      }}>
        <h3>Your Responsibilities</h3>
        <ul style={{ textAlign: 'left', lineHeight: '1.8', color: '#aaa' }}>
          <li><strong>Key Generation:</strong> Generate your cryptographic keys for each poll</li>
          <li><strong>Blind Signatures:</strong> Sign voter credentials without learning their identity</li>
          <li><strong>Threshold Participation:</strong> Work with other authorities to enable anonymous voting</li>
          <li><strong>Audit Trail:</strong> All your actions are logged for transparency</li>
        </ul>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#3a3a3a', borderRadius: '8px' }}>
        <p style={{ fontSize: '13px', color: '#888', textAlign: 'center' }}>
          Authority features (Key Generation, Blind Signing) will be implemented in the next phase.
        </p>
      </div>
    </div>
  );
};

export default AuthorityPanel;
