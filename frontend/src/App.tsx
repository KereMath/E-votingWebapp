import { useState } from 'react';
import AdminLogin from './components/AdminLogin';
import VoterLogin from './components/VoterLogin';
import AuthorityLogin from './components/AuthorityLogin';
import VoterPanel from './components/VoterPanel';
import VoterUpload from './components/VoterUpload';
import PollManagement from './components/PollManagement';
import AuthorityPanel from './components/AuthorityPanel';
import './App.css';

type UserType = 'none' | 'admin' | 'voter' | 'authority';

function App() {
  const [userType, setUserType] = useState<UserType>('none');
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [voterToken, setVoterToken] = useState<string | null>(null);
  const [voterEmail, setVoterEmail] = useState<string>('');
  const [authorityToken, setAuthorityToken] = useState<string | null>(null);
  const [authorityName, setAuthorityName] = useState<string>('');
  const [authorityEmail, setAuthorityEmail] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'voters' | 'polls'>('polls');

  const handleAdminLoginSuccess = (token: string) => {
    setAdminToken(token);
  };

  const handleVoterLoginSuccess = (token: string, email: string) => {
    setVoterToken(token);
    setVoterEmail(email);
  };

  const handleAuthorityLoginSuccess = (token: string, name: string, email: string) => {
    setAuthorityToken(token);
    setAuthorityName(name);
    setAuthorityEmail(email);
  };

  const handleLogout = () => {
    setUserType('none');
    setAdminToken(null);
    setVoterToken(null);
    setVoterEmail('');
    setAuthorityToken(null);
    setAuthorityName('');
    setAuthorityEmail('');
    setActiveTab('polls');
  };

  // Initial selection screen
  if (userType === 'none') {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Secure E-Voting System</h1>
          <p style={{ color: '#888', maxWidth: '600px', margin: '20px auto' }}>
            Threshold-based Identity Authentication with Cryptographic Privacy
          </p>
          <div style={{ marginTop: '40px' }}>
            <h2>Please select your role:</h2>
            <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', marginTop: '20px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setUserType('admin')}
                style={{ padding: '20px 40px', fontSize: '18px' }}
              >
                Admin Login
              </button>
              <button 
                onClick={() => setUserType('authority')}
                style={{ padding: '20px 40px', fontSize: '18px', backgroundColor: '#ff6b6b' }}
              >
                Election Authority
              </button>
              <button 
                onClick={() => setUserType('voter')}
                style={{ padding: '20px 40px', fontSize: '18px' }}
              >
                Voter Login
              </button>
            </div>
          </div>
        </header>
      </div>
    );
  }

  // Admin flow
  if (userType === 'admin') {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Secure E-Voting System - Admin Panel</h1>
          
          {!adminToken ? (
            <>
              <button onClick={handleLogout} style={{ marginBottom: '20px' }}>
                Back to Selection
              </button>
              <AdminLogin onLoginSuccess={handleAdminLoginSuccess} />
            </>
          ) : (
            <div style={{ width: '100%', maxWidth: '1200px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '20px',
                padding: '0 20px'
              }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setActiveTab('polls')}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: activeTab === 'polls' ? '#646cff' : '#2a2a2a',
                      border: activeTab === 'polls' ? '2px solid #646cff' : '1px solid #444'
                    }}
                  >
                    Polls & Setup
                  </button>
                  <button
                    onClick={() => setActiveTab('voters')}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: activeTab === 'voters' ? '#646cff' : '#2a2a2a',
                      border: activeTab === 'voters' ? '2px solid #646cff' : '1px solid #444'
                    }}
                  >
                    Voter Management
                  </button>
                </div>
                <button onClick={handleLogout}>Logout</button>
              </div>

              {activeTab === 'polls' ? (
                <PollManagement token={adminToken} />
              ) : (
                <VoterUpload token={adminToken} />
              )}
            </div>
          )}
        </header>
      </div>
    );
  }

  // Authority flow
  if (userType === 'authority') {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Secure E-Voting System - Election Authority</h1>
          
          {!authorityToken ? (
            <>
              <button onClick={handleLogout} style={{ marginBottom: '20px' }}>
                Back to Selection
              </button>
              <AuthorityLogin onLoginSuccess={handleAuthorityLoginSuccess} />
            </>
          ) : (
            <div style={{ width: '100%', maxWidth: '1200px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '20px',
                padding: '0 20px'
              }}>
                <h2>Welcome, {authorityName}!</h2>
                <button onClick={handleLogout}>Logout</button>
              </div>
              <AuthorityPanel token={authorityToken} name={authorityName} email={authorityEmail} />
            </div>
          )}
        </header>
      </div>
    );
  }

  // Voter flow
  if (userType === 'voter') {
    return (
      <div className="App">
        <header className="App-header">
          <h1>Secure E-Voting System - Voter Panel</h1>
          
          {!voterToken ? (
            <>
              <button onClick={handleLogout} style={{ marginBottom: '20px' }}>
                Back to Selection
              </button>
              <VoterLogin onLoginSuccess={handleVoterLoginSuccess} />
            </>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2>Welcome, {voterEmail}!</h2>
                <button onClick={handleLogout}>Logout</button>
              </div>
              <VoterPanel token={voterToken} voterEmail={voterEmail} />
            </div>
          )}
        </header>
      </div>
    );
  }

  return null;
}

export default App;