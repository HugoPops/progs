import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'https://buildphotoapp.ru/backend/api.php';

function CreateUser() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [login, setLogin] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('worker');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSubmit = async () => {
    if (!login || !name || !password) {
      showNotification('error', 'Заполните все поля');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/users?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, name, password, role })
      });

      const data = await response.json();

      if (!response.ok) {
        showNotification('error', data.error || 'Ошибка создания пользователя');
        return;
      }

      showNotification('success', `Пользователь "${name}" создан!`);
      setTimeout(() => navigate('/users'), 1500);
    } catch (error) {
      console.error('Ошибка:', error);
      showNotification('error', 'Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-6">

      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-lg text-white font-medium ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {notification.type === 'success' ? '' : ''}
          {notification.message}
        </div>
      )}

      <div className="max-w-2xl mx-auto w-full bg-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/users')}
            className="text-gray-500 hover:text-gray-700 underline text-sm"
          >
            ← Назад
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Новый пользователь</h1>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Логин</label>
            <input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="Например: User4"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ФИО</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="Например: Иван Иванов"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
              placeholder="Минимум 6 символов"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Роль</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="worker">Исполнитель</option>
              <option value="admin">Администратор</option>
            </select>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                loading
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-purple-700 text-white hover:bg-purple-800'
              }`}
            >
              {loading ? 'Создание...' : 'Создать пользователя'}
            </button>
            <button
              onClick={() => navigate('/users')}
              className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CreateUser;