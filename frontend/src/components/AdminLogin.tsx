import React, { useState } from 'react';
import axios from 'axios';

// Component'in dışarıdan bir fonksiyon alacağını belirtiyoruz.
interface AdminLoginProps {
  onLoginSuccess: (token: string) => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState(1); // 1: initial, 2: verify OTP
  const [tc, setTc] = useState('');
  const [email, setEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [message, setMessage] = useState('');

  const handleLoginStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Sending OTPs...');
    try {
      const response = await axios.post('http://localhost:8000/admin/login_start', {
        tc,
        email,
      });
      setMessage(response.data.message);
      setStep(2); // OTP doğrulama adımına geç
    } catch (error: any) {
      setMessage(`Error: ${error.response?.data?.error || 'Network Error'}`);
    }
  };

  const handleLoginVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('Verifying OTPs...');
    try {
      const response = await axios.post('http://localhost:8000/admin/login_verify', {
        tc,
        email,
        email_otp: emailOtp,
        phone_otp: phoneOtp,
      });
      // Başarılı girişte, token'ı App component'ine iletiyoruz.
      onLoginSuccess(response.data.token);
    } catch (error: any) {
      setMessage(`Error: ${error.response?.data?.error || 'Invalid OTPs'}`);
    }
  };

  // OTP doğrulama formu
  if (step === 2) {
    return (
      <div>
        <h2>Verify OTPs</h2>
        <p>Please check server logs for OTP codes.</p>
        <form onSubmit={handleLoginVerify}>
          <div>
            <label>Email OTP:</label>
            <input
              type="text"
              value={emailOtp}
              onChange={(e) => setEmailOtp(e.target.value)}
              required
            />
          </div>
          <div>
            <label>Phone OTP:</label>
            <input
              type="text"
              value={phoneOtp}
              onChange={(e) => setPhoneOtp(e.target.value)}
              required
            />
          </div>
          <button type="submit">Verify</button>
        </form>
        {message && <p>{message}</p>}
      </div>
    );
  }

  // İlk giriş formu
  return (
    <div>
      <h2>Admin Login</h2>
      <form onSubmit={handleLoginStart}>
        <div>
          <label>TC Kimlik No:</label>
          <input
            type="text"
            value={tc}
            onChange={(e) => setTc(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <button type="submit">Login</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default AdminLogin;