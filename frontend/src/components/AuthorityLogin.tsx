import React, { useState } from 'react';
import axios from 'axios';

interface AuthorityLoginProps {
  onLoginSuccess: (token: string, name: string, email: string) => void;
}

const AuthorityLogin: React.FC<AuthorityLoginProps> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState(1);
  const [tc, setTc] = useState('');
  const [email, setEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('Sending OTPs...');
    
    try {
      const response = await axios.post('http://localhost:8000/authority/login_start', {
        tc,
        email,
      });
      setMessage(response.data.message + ' Check server logs for OTP codes.');
      setStep(2);
    } catch (error: any) {
      if (error.response?.status === 404) {
        setMessage('Authority not found. Please check your credentials or contact admin.');
      } else {
        setMessage(`Error: ${error.response?.data?.error || 'Network Error'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('Verifying OTPs...');
    
    try {
      const response = await axios.post('http://localhost:8000/authority/login_verify', {
        tc,
        email,
        email_otp: emailOtp,
        phone_otp: phoneOtp,
      });
      setMessage('Login successful! Redirecting...');
      onLoginSuccess(response.data.token, response.data.authority_name, response.data.authority_email);
    } catch (error: any) {
      if (error.response?.status === 401) {
        setMessage('Invalid or expired OTP codes. Please try again.');
      } else {
        setMessage(`Error: ${error.response?.data?.error || 'Verification failed'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 2) {
    return (
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
        <h2>Verify Your Identity - Authority</h2>
        <p style={{ fontSize: '14px', color: '#888' }}>
          OTP codes have been sent to your registered email and phone.
          <br />
          <strong>Check the server console logs.</strong>
        </p>
        
        <form onSubmit={handleLoginVerify} style={{ marginTop: '20px' }}>
          <div style={{ marginBottom: '15px', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Email OTP:</label>
            <input
              type="text"
              value={emailOtp}
              onChange={(e) => setEmailOtp(e.target.value)}
              required
              maxLength={6}
              placeholder="6-digit code"
              style={{ width: '100%', padding: '10px', fontSize: '16px' }}
            />
          </div>
          
          <div style={{ marginBottom: '15px', textAlign: 'left' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Phone OTP:</label>
            <input
              type="text"
              value={phoneOtp}
              onChange={(e) => setPhoneOtp(e.target.value)}
              required
              maxLength={6}
              placeholder="6-digit code"
              style={{ width: '100%', padding: '10px', fontSize: '16px' }}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={isLoading}
            style={{ width: '100%', padding: '12px', fontSize: '16px' }}
          >
            {isLoading ? 'Verifying...' : 'Verify & Login'}
          </button>
          
          <button 
            type="button"
            onClick={() => setStep(1)}
            disabled={isLoading}
            style={{ 
              width: '100%', 
              padding: '12px', 
              fontSize: '14px', 
              marginTop: '10px',
              backgroundColor: '#555'
            }}
          >
            Back
          </button>
        </form>
        
        {message && (
          <p style={{ 
            marginTop: '20px', 
            padding: '10px', 
            backgroundColor: message.includes('Error') || message.includes('Invalid') ? '#ff44441a' : '#44ff441a',
            borderRadius: '4px'
          }}>
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '20px' }}>
      <h2>Election Authority Login</h2>
      <p style={{ fontSize: '14px', color: '#888' }}>
        Enter your registered credentials to access the authority panel
      </p>
      
      <form onSubmit={handleLoginStart} style={{ marginTop: '20px' }}>
        <div style={{ marginBottom: '15px', textAlign: 'left' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>TC Kimlik No:</label>
          <input
            type="text"
            value={tc}
            onChange={(e) => setTc(e.target.value)}
            required
            maxLength={11}
            placeholder="11-digit TC ID"
            style={{ width: '100%', padding: '10px', fontSize: '16px' }}
          />
        </div>
        
        <div style={{ marginBottom: '15px', textAlign: 'left' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="your@email.com"
            style={{ width: '100%', padding: '10px', fontSize: '16px' }}
          />
        </div>
        
        <button 
          type="submit" 
          disabled={isLoading}
          style={{ width: '100%', padding: '12px', fontSize: '16px' }}
        >
          {isLoading ? 'Sending OTPs...' : 'Continue'}
        </button>
      </form>
      
      {message && (
        <p style={{ 
          marginTop: '20px', 
          padding: '10px', 
          backgroundColor: message.includes('Error') || message.includes('not found') ? '#ff44441a' : '#44ff441a',
          borderRadius: '4px'
        }}>
          {message}
        </p>
      )}
    </div>
  );
};

export default AuthorityLogin;
