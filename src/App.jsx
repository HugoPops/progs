import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Tasks from './Tasks';
import TaskDetail from './TaskDetail';
import CreateTask from './CreateTask';
import EditTask from './EditTask';
import Users from './Users';
import CreateUser from './CreateUser';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to="/login" />;
}

function AdminRoute({ children }) {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" />;
  if (user.role !== 'admin') return <Navigate to="/tasks" />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/tasks" element={<PrivateRoute><Tasks /></PrivateRoute>} />
      <Route path="/tasks/:id" element={<PrivateRoute><TaskDetail /></PrivateRoute>} />
      <Route path="/tasks/:id/edit" element={<AdminRoute><EditTask /></AdminRoute>} />
      <Route path="/create-task" element={<AdminRoute><CreateTask /></AdminRoute>} />
      <Route path="/users" element={<AdminRoute><Users /></AdminRoute>} />
      <Route path="/create-user" element={<AdminRoute><CreateUser /></AdminRoute>} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  );
}

export default App;