import React, { useState } from 'react';
import axios from 'axios';

interface VoterUploadProps {
  token: string;
}

const VoterUpload: React.FC<VoterUploadProps> = ({ token }) => {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a file first.');
      return;
    }

    const formData = new FormData();
    formData.append('voters_file', file);
    setMessage('Uploading...');

    try {
      const response = await axios.post('http://localhost:8000/admin/upload_voters', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`, // JWT Token'ı buraya ekliyoruz!
        },
      });
      setMessage(`Upload successful! ${response.data.new_voters_inserted} new voters inserted.`);
    } catch (error: any) {
      setMessage(`Upload failed: ${error.response?.data?.error || error.message}`);
    }
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <h3>Upload Voters CSV</h3>
      <p>CSV format: tc,email,phone (no header)</p>
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>
      {message && <p>{message}</p>}
    </div>
  );
};

export default VoterUpload;