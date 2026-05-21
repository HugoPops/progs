import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_URL = 'https://buildphotoapp.ru/backend/api.php';

function CreateTask() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [executor, setExecutor] = useState('');
  const [photosCount, setPhotosCount] = useState(1);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_URL}/users?token=${token}`);
        if (!response.ok) throw new Error('Ошибка загрузки пользователей');
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleSubmit = async () => {
    if (!title || !executor) {
      alert('Заполните название и выберите исполнителя');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/tasks?token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          executor,
          photosCount: parseInt(photosCount),
          status: 'pending'
        })
      });

      if (!response.ok) throw new Error('Ошибка создания задачи');

      const result = await response.json();
      alert(`Задача "${title}" создана! ID: ${result.id}`);
      navigate('/tasks');
    } catch (error) {
      console.error('Ошибка создания:', error);
      alert('Ошибка при создании задачи');
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p>Загрузка...</p></div>;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto w-full bg-white p-6 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Новая задача</h1>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название задачи</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            ></textarea>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Выберите исполнителя</label>
            <select
              value={executor}
              onChange={(e) => setExecutor(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="">Выберите исполнителя...</option>
              {users.map(user => (
                <option key={user.id} value={user.login}>
                  {user.name} ({user.login})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Количество фото (1–10)
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={photosCount}
              onChange={(e) => setPhotosCount(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={handleSubmit}
              className="flex-1 py-3 bg-purple-700 text-white rounded-lg hover:bg-purple-800 transition font-medium"
            >
              Создать задачу
            </button>
            <button
              onClick={() => navigate('/tasks')}
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

export default CreateTask;