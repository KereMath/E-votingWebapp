import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SetupParamsDisplay from './SetupParamsDisplay';

interface VoterPanelProps {
  token: string;
  voterEmail: string;
}

interface Poll {
  id: number;
  title: string;
  description: string | null;
  status: string;
  has_voted: boolean;
  voted_at: string | null;
  started_at: string | null;
  ended_at: string | null;
}

const VoterPanel: React.FC<VoterPanelProps> = ({ token, voterEmail }) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPoll, setSelectedPoll] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchVoterPolls();
  }, []);

  const fetchVoterPolls = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/voter/polls', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPolls(response.data.polls);
    } catch (error: any) {
      console.error('Failed to fetch polls:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ 
      marginTop: '40px', 
      borderTop: '2px solid #555', 
      paddingTop: '30px',
      maxWidth: '1000px',
      margin: '40px auto 0'
    }}>
      <h2>Your Active Polls</h2>
      <p style={{ color: '#888', fontSize: '14px' }}>
        View setup parameters and participate in active polls
      </p>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading your polls...</p>
        </div>
      ) : polls.length === 0 ? (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center',
          backgroundColor: '#2a2a2a',
          borderRadius: '8px',
          marginTop: '20px'
        }}>
          <p style={{ color: '#888' }}>
            You don't have any active polls at the moment.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>
          {polls.map(poll => (
            <div
              key={poll.id}
              style={{
                border: '2px solid #444',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: '#2a2a2a'
              }}
            >
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                marginBottom: '15px'
              }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 10px 0' }}>{poll.title}</h3>
                  {poll.description && (
                    <p style={{ color: '#aaa', fontSize: '14px', margin: '0 0 10px 0' }}>
                      {poll.description}
                    </p>
                  )}
                  <div style={{ fontSize: '12px', color: '#888' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: poll.has_voted ? '#44ff4433' : '#ff444433',
                      color: poll.has_voted ? '#44ff44' : '#ff4444',
                      marginRight: '10px'
                    }}>
                      {poll.has_voted ? '✓ Voted' : 'Not Voted'}
                    </span>
                    {poll.voted_at && (
                      <span>Voted: {new Date(poll.voted_at).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedPoll(selectedPoll === poll.id ? null : poll.id)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2a2a2a',
                    border: '1px solid #646cff',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  {selectedPoll === poll.id ? 'Hide Parameters' : 'View Setup Parameters'}
                </button>
              </div>

              {/* Show setup parameters if selected */}
              {selectedPoll === poll.id && (
                <SetupParamsDisplay pollId={poll.id} />
              )}

              {/* Voting section (coming soon) */}
              {selectedPoll === poll.id && !poll.has_voted && (
                <div style={{
                  marginTop: '20px',
                  padding: '20px',
                  backgroundColor: '#3a3a3a',
                  borderRadius: '8px',
                  border: '1px solid #646cff'
                }}>
                  <h4 style={{ marginTop: 0 }}>Vote in this Poll</h4>
                  <p style={{ fontSize: '14px', color: '#aaa' }}>
                    Cryptographic voting functionality will be implemented soon.
                    You'll be able to cast your vote anonymously using the setup parameters above.
                  </p>
                  <button
                    disabled
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#555',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'not-allowed',
                      opacity: 0.5
                    }}
                  >
                    Cast Vote (Coming Soon)
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: '40px',
        padding: '20px',
        backgroundColor: '#2a2a2a',
        borderRadius: '8px',
        fontSize: '13px',
        color: '#aaa'
      }}>
        <strong style={{ color: '#fff' }}>ℹ️ How It Works</strong>
        <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
          <li>Each poll has unique cryptographic setup parameters</li>
          <li>These parameters ensure anonymous and verifiable voting</li>
          <li>You can view the parameters anytime to verify the poll's integrity</li>
          <li>Your vote will be cryptographically secure and cannot be traced back to you</li>
        </ul>
      </div>
    </div>
  );
};

export default VoterPanel;