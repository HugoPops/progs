import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

const API_URL = 'https://buildphotoapp.ru/backend/api.php';

const STATUS_OPTIONS = [
  { value: 'pending',   label: 'В работе'      },
  { value: 'review',    label: 'На проверке'   },
  { value: 'completed', label: 'Выполнено'     },
  { value: 'rejected',  label: 'Отклонено'     },
];

function EditTask() {
  const navigate = useNavigate();
  const { id } = useParams();
  const token = localStorage.getItem('token');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [executor, setExecutor] = useState('');
  const [requiredPhotos, setRequiredPhotos] = useState(1);
  const [status, setStatus] = useState('pending');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 3000);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [taskRes, usersRes] = await Promise.all([
          fetch(`${API_URL}/tasks/${id}?token=${token}`),
          fetch(`${API_URL}/users?token=${token}`)
        ]);

        if (!taskRes.ok) throw new Error('Задача не найдена');

        const task = await taskRes.json();
        const usersData = await usersRes.json();

        setTitle(task.title || '');
        setDescription(task.description || '');
        setExecutor(task.executor || '');
        setRequiredPhotos(task.required_photos || 1);
        setStatus(task.status || 'pending');
        setUsers(Array.isArray(usersData) ? usersData : []);
      } catch (error) {
        showNotification('error', 'Ошибка загрузки данных');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const handleSubmit = async () => {
    if (!title || !executor) {
      showNotification('error', 'Заполните название и выберите исполнителя');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/tasks/${id}?token=${token}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          executor,
          requiredPhotos: parseInt(requiredPhotos),
          status
        })
      });

      if (!response.ok) throw new Error('Ошибка сохранения');

      showNotification('success', 'Задача обновлена!');
      setTimeout(() => navigate('/tasks'), 1500);
    } catch (error) {
      showNotification('error', 'Ошибка при сохранении');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen bg-gray-50"><p>Загрузка...</p></div>;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 p-6">

      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-xl shadow-lg text-white font-medium ${
          notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        }`}>
          {notification.type === 'success' ? ' ' : ' '}
          {notification.message}
        </div>
      )}

      <div className="max-w-2xl mx-auto w-full bg-white p-6 rounded-xl shadow-lg">
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-gray-700 underline text-sm"
          >
            ← Назад
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Редактировать задачу</h1>
        </div>

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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Исполнитель</label>
            <select
              value={executor}
              onChange={(e) => setExecutor(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="">Выберите исполнителя...</option>
              {users.map(u => (
                <option key={u.id} value={u.login}>
                  {u.name} ({u.login})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Количество фото (1–10)</label>
            <input
              type="number"
              min="1"
              max="10"
              value={requiredPhotos}
              onChange={(e) => setRequiredPhotos(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Статус</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
            >
              {STATUS_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                saving
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-purple-700 text-white hover:bg-purple-800'
              }`}
            >
              {saving ? 'Сохранение...' : 'Сохранить изменения'}
            </button>
            <button
              onClick={() => navigate(-1)}
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

export default EditTask;