import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'https://buildphotoapp.ru/backend/api.php';

function Users() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_URL}/users?token=${token}`);
        if (!response.ok) throw new Error('Ошибка загрузки');
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Ошибка:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Удалить пользователя "${name}"?`)) return;

    try {
      const response = await fetch(`${API_URL}/users/${id}?token=${token}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const data = await response.json();
        showNotification('error', data.error || 'Ошибка удаления');
        return;
      }

      setUsers(users.filter(u => u.id !== id));
      showNotification('success', 'Пользователь удалён');
    } catch (error) {
      showNotification('error', 'Ошибка соединения');
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p>Загрузка...</p></div>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-lg text-white font-medium ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {notification.type === 'success' ? ' ' : ' '}
          {notification.message}
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Пользователи</h1>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/create-user')}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Добавить
            </button>
            <button
              onClick={() => navigate('/tasks')}
              className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              К задачам
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="bg-white p-5 rounded-xl shadow-md flex justify-between items-center">
              <div>
                <p className="text-lg font-semibold text-gray-800">{user.name}</p>
                <p className="text-sm text-gray-500">Логин: {user.login}</p>
                <p className="text-sm text-gray-500">
                  Роль: <span className={`font-medium ${user.role === 'admin' ? 'text-purple-600' : 'text-blue-600'}`}>
                    {user.role === 'admin' ? 'Администратор' : 'Исполнитель'}
                  </span>
                </p>
              </div>
              <button
                onClick={() => handleDelete(user.id, user.name)}
                className="text-red-500 hover:text-red-700 text-sm"
              >
                Удалить
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Users;