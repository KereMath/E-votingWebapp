import { useState } from 'react';
import AdminLogin from './components/AdminLogin';
import VoterPanel from './components/VoterPanel';
import VoterUpload from './components/VoterUpload'; // Import et
import './App.css';

function App() {
  const [token, setToken] = useState<string | null>(null);

  // AdminLogin component'inden token'ı almak için bir fonksiyon
  const handleLoginSuccess = (newToken: string) => {
    setToken(newToken);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Secure E-Voting System</h1>

        {!token ? (
          <AdminLogin onLoginSuccess={handleLoginSuccess} />
        ) : (
          <div>
            <h2>Admin Dashboard</h2>
            <VoterUpload token={token} />
            <VoterPanel />
          </div>
        )}

      </header>
    </div>
  );
}

export default App;