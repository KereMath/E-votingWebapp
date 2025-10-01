import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SetupParamsDisplay from './SetupParamsDisplay';

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

const PollManagement: React.FC<PollManagementProps> = ({ token }) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPollForDetails, setSelectedPollForDetails] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [votersFile, setVotersFile] = useState<File | null>(null);

  useEffect(() => {
    fetchPolls();
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setVotersFile(e.target.files[0]);
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('title', title);
    if (description) {
      formData.append('description', description);
    }
    if (votersFile) {
      formData.append('voters_file', votersFile);
    }

    try {
      const response = await axios.post(
        'http://localhost:8000/admin/polls',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          }
        }
      );

      setMessage(`Poll created successfully! ${response.data.voters_added || 0} voters added.`);
      setTitle('');
      setDescription('');
      setVotersFile(null);
      setShowCreateForm(false);
      fetchPolls();
    } catch (error: any) {
      setMessage(`Error: ${error.response?.data?.error || 'Failed to create poll'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerSetup = async (pollId: number) => {
    if (!confirm('Are you sure you want to run cryptographic setup? This may take a few seconds and cannot be undone.')) {
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
      setSelectedPollForDetails(pollId);
    } catch (error: any) {
      setMessage(`Setup failed: ${error.response?.data?.error || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
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
          borderRadius: '8px',
          border: message.includes('Error') || message.includes('failed') ? '1px solid #ff4444' : '1px solid #44ff44'
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
              <label style={{ display: 'block', marginBottom: '10px' }}>Voters CSV File (Optional)</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ width: '100%', padding: '10px' }}
              />
              <p style={{ fontSize: '12px', color: '#888', marginTop: '5px' }}>
                CSV format: tc,email,phone (no header row)
                <br />
                Example: 12345678901,voter@email.com,05551234567
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
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

                  <div style={{ textAlign: 'right', display: 'flex', gap: '10px' }}>
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
                        Run Setup
                      </button>
                    )}
                    {poll.status === 'active' && (
                      <button
                        onClick={() => setSelectedPollForDetails(
                          selectedPollForDetails === poll.id ? null : poll.id
                        )}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#2a2a2a',
                          border: '1px solid #44ff44',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          color: '#44ff44'
                        }}
                      >
                        {selectedPollForDetails === poll.id ? 'Hide Parameters' : 'View Parameters'}
                      </button>
                    )}
                  </div>
                </div>

                {selectedPollForDetails === poll.id && poll.status === 'active' && (
                  <SetupParamsDisplay pollId={poll.id} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PollManagement;