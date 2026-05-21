import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'https://buildphotoapp.ru/backend/api.php';

function Login() {
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!login || !password) { setError('Введите логин и пароль'); return; }
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password })
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Ошибка авторизации'); return; }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/tasks');
    } catch { setError('Ошибка соединения с сервером'); }
    finally { setLoading(false); }
  };

  return (
    <div style={styles.screen}>
      <div style={styles.card}>
        <h1 style={styles.title}>Вход</h1>

        {error && <div style={styles.errorBox}>{error}</div>}

        <input
          style={styles.input}
          type="text"
          placeholder="Логин"
          value={login}
          onChange={e => setLogin(e.target.value)}
        />
        <input
          style={styles.input}
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />

        <button
          style={{ ...styles.btn, opacity: loading ? 0.6 : 1 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  screen: {
    minHeight: '100vh',
    backgroundColor: '#f0edf8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 24px',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: '40px 32px',
    boxShadow: '0 8px 32px rgba(124, 58, 237, 0.10), 0 1px 4px rgba(0,0,0,0.06)',
    border: '1.5px solid #ede9fe',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    marginTop: 0,
  },
  errorBox: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 14,
  },
  input: {
    width: '100%',
    padding: '16px',
    fontSize: 16,
    border: '1.5px solid #e0e0e0',
    borderRadius: 12,
    outline: 'none',
    boxSizing: 'border-box',
    color: '#1a1a1a',
    backgroundColor: '#fff',
  },
  btn: {
    width: '100%',
    padding: '16px',
    borderRadius: 12,
    border: 'none',
    backgroundColor: '#7c3aed',
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    cursor: 'pointer',
    marginTop: 4,
  },
};

export default Login;