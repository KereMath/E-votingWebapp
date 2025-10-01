import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface PollManagementProps {
  token: string;
}

interface Poll {
  id: number;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  voter_count?: number;
  setup_completed?: boolean;
}

interface Voter {
  id: number;
  email: string;
}

const PollManagement: React.FC<PollManagementProps> = ({ token }) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedVoters, setSelectedVoters] = useState<number[]>([]);

  useEffect(() => {
    fetchPolls();
    fetchVoters();
  }, []);

  const fetchPolls = async () => {
    try {
      const response = await axios.get('http://localhost:8000/admin/polls', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setPolls(response.data.polls);
    } catch (error: any) {
      console.error('Failed to fetch polls:', error);
    }
  };

  const fetchVoters = async () => {
    try {
      // Bu endpoint eklenecek - şimdilik mock data
      setVoters([
        { id: 1, email: 'voter1@example.com' },
        { id: 2, email: 'voter2@example.com' },
        { id: 3, email: 'voter3@example.com' },
      ]);
    } catch (error: any) {
      console.error('Failed to fetch voters:', error);
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await axios.post(
        'http://localhost:8000/admin/polls',
        {
          title,
          description: description || null,
          voter_ids: selectedVoters
        },
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      setMessage('Poll created successfully!');
      setTitle('');
      setDescription('');
      setSelectedVoters([]);
      setShowCreateForm(false);
      fetchPolls();
    } catch (error: any) {
      setMessage(`Error: ${error.response?.data?.error || 'Failed to create poll'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerSetup = async (pollId: number) => {
    if (!confirm('Are you sure you want to run cryptographic setup? This cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    setMessage('Running cryptographic setup... This may take a few seconds.');

    try {
      const response = await axios.post(
        `http://localhost:8000/admin/polls/${pollId}/setup`,
        {},
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      setMessage('Setup completed successfully! Poll is now active.');
      fetchPolls();
    } catch (error: any) {
      setMessage(`Setup failed: ${error.response?.data?.error || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleVoterSelection = (voterId: number) => {
    setSelectedVoters(prev =>
      prev.includes(voterId)
        ? prev.filter(id => id !== voterId)
        : [...prev, voterId]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return '#888';
      case 'active': return '#4CAF50';
      case 'closed': return '#f44336';
      default: return '#888';
    }
  };

  return (
    <div style={{ marginTop: '40px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Poll Management</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          style={{ padding: '10px 20px' }}
        >
          {showCreateForm ? 'Cancel' : '+ Create New Poll'}
        </button>
      </div>

      {message && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          backgroundColor: message.includes('Error') || message.includes('failed') ? '#ff44441a' : '#44ff441a',
          borderRadius: '8px'
        }}>
          {message}
        </div>
      )}

      {showCreateForm && (
        <div style={{
          border: '2px solid #646cff',
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '30px',
          backgroundColor: '#1a1a1a'
        }}>
          <h3>Create New Poll</h3>
          <form onSubmit={handleCreatePoll}>
            <div style={{ marginBottom: '15px', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Poll Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g., Presidential Election 2025"
                style={{ width: '100%', padding: '10px' }}
              />
            </div>

            <div style={{ marginBottom: '15px', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '5px' }}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={3}
                style={{ width: '100%', padding: '10px' }}
              />
            </div>

            <div style={{ marginBottom: '15px', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '10px' }}>Select Voters *</label>
              <div style={{
                maxHeight: '200px',
                overflowY: 'auto',
                border: '1px solid #444',
                borderRadius: '4px',
                padding: '10px'
              }}>
                {voters.map(voter => (
                  <div key={voter.id} style={{ marginBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={selectedVoters.includes(voter.id)}
                        onChange={() => toggleVoterSelection(voter.id)}
                        style={{ marginRight: '10px' }}
                      />
                      {voter.email}
                    </label>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                Selected: {selectedVoters.length} voters
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading || selectedVoters.length === 0}
              style={{ width: '100%', padding: '12px', fontSize: '16px' }}
            >
              {isLoading ? 'Creating...' : 'Create Poll'}
            </button>
          </form>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <h3>Existing Polls</h3>
        {polls.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '40px' }}>
            No polls created yet. Create your first poll above!
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '15px' }}>
            {polls.map(poll => (
              <div
                key={poll.id}
                style={{
                  border: '1px solid #444',
                  borderRadius: '8px',
                  padding: '20px',
                  backgroundColor: '#2a2a2a'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 10px 0' }}>{poll.title}</h4>
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
                        backgroundColor: getStatusColor(poll.status) + '33',
                        color: getStatusColor(poll.status),
                        marginRight: '10px'
                      }}>
                        {poll.status.toUpperCase()}
                      </span>
                      <span>Created: {new Date(poll.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    {poll.status === 'draft' && (
                      <button
                        onClick={() => handleTriggerSetup(poll.id)}
                        disabled={isLoading}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#646cff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        🔐 Run Setup
                      </button>
                    )}
                    {poll.setup_completed && (
                      <span style={{ color: '#4CAF50', fontSize: '12px' }}>
                        ✓ Setup Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PollManagement;