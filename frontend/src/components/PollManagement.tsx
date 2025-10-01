import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SetupParamsDisplay from './SetupParamsDisplay';
import KeyGenDisplay from './KeyGenDisplay';

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
  authority_count?: number;
  threshold?: number;
  setup_completed?: boolean;
  keygen_completed?: boolean;
}

const PollManagement: React.FC<PollManagementProps> = ({ token }) => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPollForDetails, setSelectedPollForDetails] = useState<number | null>(null);
  const [selectedPollForKeygen, setSelectedPollForKeygen] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'manage' | 'participants'>('manage');
  const [selectedPoll, setSelectedPoll] = useState<number | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    fetchPolls();
  }, []);

  const fetchPolls = async () => {
    try {
      const response = await axios.get('http://localhost:8000/admin/polls', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // Fetch details for each poll to get counts
      const pollsWithDetails = await Promise.all(
        response.data.polls.map(async (poll: Poll) => {
          try {
            const details = await axios.get(`http://localhost:8000/admin/polls/${poll.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            return { ...poll, ...details.data };
          } catch {
            return poll;
          }
        })
      );
      
      setPolls(pollsWithDetails);
    } catch (error: any) {
      console.error('Failed to fetch polls:', error);
    }
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await axios.post(
        'http://localhost:8000/admin/polls',
        { title, description: description || null },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }
        }
      );

      setMessage('Poll created successfully!');
      setTitle('');
      setDescription('');
      setShowCreateForm(false);
      fetchPolls();
    } catch (error: any) {
      setMessage(`Error: ${error.response?.data?.error || 'Failed to create poll'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerSetup = async (pollId: number) => {
    if (!confirm('Run cryptographic setup? This may take a few seconds.')) {
      return;
    }

    setIsLoading(true);
    setMessage('Running TIAC Setup (Algorithm 1)...');

    try {
      const response = await axios.post(
        `http://localhost:8000/admin/polls/${pollId}/setup`,
        {},
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      setMessage('Setup completed! params = (G₁, G₂, Gₜ, p, g₁, g₂, h₁) generated.');
      fetchPolls();
      setSelectedPollForDetails(pollId);
    } catch (error: any) {
      setMessage(`Setup failed: ${error.response?.data?.error || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerKeygen = async (pollId: number) => {
    const poll = polls.find(p => p.id === pollId);
    if (!poll?.authority_count || poll.authority_count === 0) {
      setMessage('Please add authorities before running keygen.');
      return;
    }

    if (!confirm(`Run Key Generation (Algorithm 2)?\nAuthorities: ${poll.authority_count}\nThreshold: ${poll.threshold}`)) {
      return;
    }

    setIsLoading(true);
    setMessage('Running TIAC KeyGen (Algorithm 2)...');

    try {
      const response = await axios.post(
        `http://localhost:8000/admin/polls/${pollId}/keygen`,
        {},
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      setMessage(`KeyGen completed! MVK broadcast to all, SGK distributed to ${poll.authority_count} authorities.`);
      fetchPolls();
      setSelectedPollForKeygen(pollId);
    } catch (error: any) {
      setMessage(`KeyGen failed: ${error.response?.data?.error || 'Unknown error'}`);
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

  const getProgressSteps = (poll: Poll) => {
    const steps = [
      { label: 'Poll Created', completed: true },
      { label: 'Participants Added', completed: (poll.voter_count || 0) > 0 && (poll.authority_count || 0) > 0 },
      { label: 'Setup Complete', completed: poll.setup_completed || false },
      { label: 'KeyGen Complete', completed: poll.keygen_completed || false },
      { label: 'Active', completed: poll.status === 'active' }
    ];
    return steps;
  };

  return (
    <div style={{ marginTop: '40px', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setActiveTab('manage')}
            style={{
              padding: '10px 20px',
              backgroundColor: activeTab === 'manage' ? '#646cff' : '#2a2a2a',
              border: activeTab === 'manage' ? '2px solid #646cff' : '1px solid #444'
            }}
          >
            Manage Polls
          </button>
          <button
            onClick={() => setActiveTab('participants')}
            style={{
              padding: '10px 20px',
              backgroundColor: activeTab === 'participants' ? '#646cff' : '#2a2a2a',
              border: activeTab === 'participants' ? '2px solid #646cff' : '1px solid #444'
            }}
          >
            Participants
          </button>
        </div>
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

      {activeTab === 'manage' ? (
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
                      
                      {/* Progress Steps */}
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', flexWrap: 'wrap' }}>
                        {getProgressSteps(poll).map((step, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              backgroundColor: step.completed ? '#44ff4433' : '#44444433',
                              color: step.completed ? '#44ff44' : '#888',
                              border: `1px solid ${step.completed ? '#44ff44' : '#444'}`
                            }}
                          >
                            {step.completed ? '✓' : '○'} {step.label}
                          </div>
                        ))}
                      </div>

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
                        <span>Voters: {poll.voter_count || 0}</span>
                        <span style={{ marginLeft: '10px' }}>
                          Authorities: {poll.authority_count || 0} 
                          {poll.threshold && ` (t=${poll.threshold})`}
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', display: 'flex', gap: '10px', flexDirection: 'column' }}>
                      <button
                        onClick={() => {
                          setSelectedPoll(poll.id);
                          setActiveTab('participants');
                        }}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#2a2a2a',
                          border: '1px solid #646cff'
                        }}
                      >
                        Manage Participants
                      </button>

                      {!poll.setup_completed && (
                        <button
                          onClick={() => handleTriggerSetup(poll.id)}
                          disabled={isLoading}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            backgroundColor: '#646cff',
                            border: 'none'
                          }}
                        >
                          Run Setup
                        </button>
                      )}

                      {poll.setup_completed && !poll.keygen_completed && (poll.authority_count || 0) > 0 && (
                        <button
                          onClick={() => handleTriggerKeygen(poll.id)}
                          disabled={isLoading}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            backgroundColor: '#ff6b6b',
                            border: 'none'
                          }}
                        >
                          Run KeyGen
                        </button>
                      )}

                      {poll.setup_completed && (
                        <button
                          onClick={() => setSelectedPollForDetails(
                            selectedPollForDetails === poll.id ? null : poll.id
                          )}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            backgroundColor: '#2a2a2a',
                            border: '1px solid #44ff44'
                          }}
                        >
                          {selectedPollForDetails === poll.id ? 'Hide Setup' : 'View Setup'}
                        </button>
                      )}

                      {poll.keygen_completed && (
                        <button
                          onClick={() => setSelectedPollForKeygen(
                            selectedPollForKeygen === poll.id ? null : poll.id
                          )}
                          style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            backgroundColor: '#2a2a2a',
                            border: '1px solid #ff6b6b'
                          }}
                        >
                          {selectedPollForKeygen === poll.id ? 'Hide Keys' : 'View Keys'}
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedPollForDetails === poll.id && poll.setup_completed && (
                    <SetupParamsDisplay pollId={poll.id} />
                  )}

                  {selectedPollForKeygen === poll.id && poll.keygen_completed && (
                    <KeyGenDisplay pollId={poll.id} />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ParticipantsManager 
          token={token} 
          polls={polls}
          selectedPoll={selectedPoll}
          onPollSelect={setSelectedPoll}
          onUpdate={fetchPolls}
        />
      )}
    </div>
  );
};

// Participants Manager Component
interface ParticipantsManagerProps {
  token: string;
  polls: Poll[];
  selectedPoll: number | null;
  onPollSelect: (id: number | null) => void;
  onUpdate: () => void;
}

const ParticipantsManager: React.FC<ParticipantsManagerProps> = ({ 
  token, 
  polls, 
  selectedPoll, 
  onPollSelect,
  onUpdate 
}) => {
  const [votersFile, setVotersFile] = useState<File | null>(null);
  const [authoritiesFile, setAuthoritiesFile] = useState<File | null>(null);
  const [participants, setParticipants] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedPoll) {
      fetchParticipants();
    }
  }, [selectedPoll]);

  const fetchParticipants = async () => {
    if (!selectedPoll) return;
    
    try {
      const response = await axios.get(
        `http://localhost:8000/admin/polls/${selectedPoll}/participants`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      setParticipants(response.data);
    } catch (error) {
      console.error('Failed to fetch participants:', error);
    }
  };

  const handleUploadVoters = async () => {
    if (!selectedPoll || !votersFile) return;
    
    setIsLoading(true);
    const formData = new FormData();
    formData.append('voters_file', votersFile);

    try {
      const response = await axios.post(
        `http://localhost:8000/admin/polls/${selectedPoll}/voters`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          }
        }
      );
      setMessage(`Voters added: ${response.data.added_to_poll} of ${response.data.total_in_file}`);
      setVotersFile(null);
      fetchParticipants();
      onUpdate();
    } catch (error: any) {
      setMessage(`Error: ${error.response?.data?.error || 'Failed to add voters'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadAuthorities = async () => {
    if (!selectedPoll || !authoritiesFile) return;
    
    setIsLoading(true);
    const formData = new FormData();
    formData.append('authorities_file', authoritiesFile);

    try {
      const response = await axios.post(
        `http://localhost:8000/admin/polls/${selectedPoll}/authorities`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          }
        }
      );
      setMessage(`Authorities added: ${response.data.added_to_poll} of ${response.data.total_in_file}. Threshold: ${response.data.threshold}`);
      setAuthoritiesFile(null);
      fetchParticipants();
      onUpdate();
    } catch (error: any) {
      setMessage(`Error: ${error.response?.data?.error || 'Failed to add authorities'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <h3>Manage Poll Participants</h3>
      
      <div style={{ marginBottom: '20px' }}>
        <label>Select Poll:</label>
        <select 
          value={selectedPoll || ''} 
          onChange={(e) => onPollSelect(e.target.value ? parseInt(e.target.value) : null)}
          style={{ marginLeft: '10px', padding: '8px' }}
        >
          <option value="">-- Select a Poll --</option>
          {polls.map(poll => (
            <option key={poll.id} value={poll.id}>{poll.title}</option>
          ))}
        </select>
      </div>

      {selectedPoll && (
        <>
          {message && (
            <div style={{
              padding: '10px',
              marginBottom: '20px',
              backgroundColor: message.includes('Error') ? '#ff44441a' : '#44ff441a',
              borderRadius: '8px'
            }}>
              {message}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            {/* Voters Section */}
            <div style={{
              border: '1px solid #444',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#2a2a2a'
            }}>
              <h4>Voters ({participants?.voter_count || 0})</h4>
              <div style={{ marginBottom: '15px' }}>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setVotersFile(e.target.files?.[0] || null)}
                  style={{ marginBottom: '10px' }}
                />
                <button
                  onClick={handleUploadVoters}
                  disabled={!votersFile || isLoading}
                  style={{ width: '100%', padding: '8px' }}
                >
                  Upload Voters CSV
                </button>
                <p style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                  Format: tc,email,phone
                </p>
              </div>
              
              {participants?.voters && participants.voters.length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {participants.voters.map((v: any) => (
                    <div key={v.id} style={{ fontSize: '12px', padding: '4px 0' }}>
                      {v.email}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Authorities Section */}
            <div style={{
              border: '1px solid #444',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#2a2a2a'
            }}>
              <h4>
                Authorities ({participants?.authority_count || 0})
                {participants?.threshold && (
                  <span style={{ fontSize: '12px', color: '#ff6b6b' }}> (t={participants.threshold})</span>
                )}
              </h4>
              <div style={{ marginBottom: '15px' }}>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setAuthoritiesFile(e.target.files?.[0] || null)}
                  style={{ marginBottom: '10px' }}
                />
                <button
                  onClick={handleUploadAuthorities}
                  disabled={!authoritiesFile || isLoading}
                  style={{ width: '100%', padding: '8px' }}
                >
                  Upload Authorities CSV
                </button>
                <p style={{ fontSize: '11px', color: '#888', marginTop: '5px' }}>
                  Format: tc,email,phone,name
                </p>
              </div>
              
              {participants?.authorities && participants.authorities.length > 0 && (
                <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {participants.authorities.map((a: any) => (
                    <div key={a.id} style={{ fontSize: '12px', padding: '4px 0' }}>
                      {a.name} ({a.email})
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Threshold Info */}
          {participants?.authority_count > 0 && (
            <div style={{
              padding: '15px',
              backgroundColor: '#ff6b6b1a',
              borderRadius: '8px',
              border: '1px solid #ff6b6b'
            }}>
              <strong>Threshold Configuration:</strong>
              <p style={{ margin: '5px 0', fontSize: '14px' }}>
                {participants.authority_count} authorities → threshold = {participants.threshold}
                <br />
                <span style={{ fontSize: '12px', color: '#aaa' }}>
                  {participants.threshold} out of {participants.authority_count} authorities must sign for valid credentials
                </span>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PollManagement;