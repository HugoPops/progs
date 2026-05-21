<?php
error_reporting(0);
ini_set('display_errors', 0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Max-Age: 3600");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Expose-Headers: Content-Length, Content-Range");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once __DIR__ . '/db.php';

function api_response($data, $code = 200) {
    http_response_code($code);
    header("Content-Type: application/json; charset=UTF-8");
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function getAuthUser($mysql) {
    $token = '';

    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']);
    } elseif (!empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $token = str_replace('Bearer ', '', $_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    } elseif (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $key => $val) {
            if (strtolower($key) === 'authorization') {
                $token = str_replace('Bearer ', '', $val);
                break;
            }
        }
    }

    if (empty($token) && !empty($_GET['token'])) {
        $token = $_GET['token'];
    }

    if (empty($token) && !empty($_POST['token'])) {
        $token = $_POST['token'];
    }

    if (empty($token)) return null;

    $token = trim($token);

    $stmt = $mysql->prepare(
        "SELECT u.id, u.login, u.name, u.role 
         FROM users u 
         INNER JOIN sessions s ON s.user_id = u.id 
         WHERE s.token = ? AND s.expires_at > NOW() 
         LIMIT 1"
    );
    if (!$stmt) return null;
    $stmt->bind_param("s", $token);
    $stmt->execute();
    return $stmt->get_result()->fetch_assoc();
}

if (!isset($mysql)) {
    api_response(array('error' => 'Ошибка подключения к базе данных'), 500);
}

$requestPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$pathParts = explode('/', trim($requestPath, '/'));

$action = '';
$id = null;

foreach ($pathParts as $i => $part) {
    if (in_array($part, array('tasks', 'users', 'photos', 'login', 'logout'))) {
        $action = $part;
        $id = isset($pathParts[$i + 1]) && $pathParts[$i + 1] !== '' ? $pathParts[$i + 1] : null;
        break;
    }
}

$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'login') {
    if ($method !== 'POST') api_response(array('error' => 'Метод не разрешен'), 405);

    $input = file_get_contents('php://input');
    $data  = json_decode($input, true);

    $login    = isset($data['login'])    ? $data['login']    : '';
    $password = isset($data['password']) ? $data['password'] : '';

    if (empty($login) || empty($password)) {
        api_response(array('error' => 'Логин и пароль обязательны'), 400);
    }

    $stmt = $mysql->prepare("SELECT * FROM users WHERE login = ?");
    if (!$stmt) api_response(array('error' => 'Prepare error: ' . $mysql->error), 500);

    $stmt->bind_param("s", $login);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();

    if (!$user) api_response(array('error' => 'Пользователь не найден'), 401);
    if (!password_verify($password, $user['password'])) api_response(array('error' => 'Неверный пароль'), 401);

    $token     = md5(uniqid(mt_rand(), true)) . md5(uniqid(mt_rand(), true));
    $expiresAt = date('Y-m-d H:i:s', strtotime('+7 days'));

    $stmt2 = $mysql->prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)");
    if (!$stmt2) api_response(array('error' => 'Sessions error: ' . $mysql->error), 500);

    $stmt2->bind_param("iss", $user['id'], $token, $expiresAt);
    $stmt2->execute();

    api_response(array(
        'token' => $token,
        'user'  => array(
            'id'    => $user['id'],
            'login' => $user['login'],
            'name'  => $user['name'],
            'role'  => $user['role']
        )
    ));
}


if ($action === 'logout') {
    if ($method !== 'POST') api_response(array('error' => 'Метод не разрешен'), 405);

    $token = '';
    if (!empty($_SERVER['HTTP_AUTHORIZATION'])) {
        $token = str_replace('Bearer ', '', $_SERVER['HTTP_AUTHORIZATION']);
    } elseif (!empty($_GET['token'])) {
        $token = $_GET['token'];
    }

    if (!empty($token)) {
        $stmt = $mysql->prepare("DELETE FROM sessions WHERE token = ?");
        $stmt->bind_param("s", $token);
        $stmt->execute();
    }

    api_response(array('success' => true));
}


$authUser = getAuthUser($mysql);
if (!$authUser) {
    api_response(array('error' => 'Необходима авторизация'), 401);
}


if ($action === 'tasks') {

    if ($method === 'GET' && $id !== null) {
        $stmt = $mysql->prepare(
            "SELECT t.*, u.name as executor_name 
             FROM tasks t 
             LEFT JOIN users u ON u.login = t.executor 
             WHERE t.id = ?"
        );
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();

        if (!$row) api_response(array('error' => 'Задача не найдена'), 404);

        if ($authUser['role'] === 'worker' && $row['executor'] !== $authUser['login']) {
            api_response(array('error' => 'Доступ запрещен'), 403);
        }

        api_response($row);
    }

    if ($method === 'GET') {
        if ($authUser['role'] === 'admin') {
            $result = $mysql->query(
                "SELECT t.*, u.name as executor_name 
                 FROM tasks t 
                 LEFT JOIN users u ON u.login = t.executor 
                 ORDER BY t.created_at DESC"
            );
        } else {
            $stmt = $mysql->prepare(
                "SELECT t.*, u.name as executor_name 
                 FROM tasks t 
                 LEFT JOIN users u ON u.login = t.executor 
                 WHERE t.executor = ? 
                 ORDER BY t.created_at DESC"
            );
            $stmt->bind_param("s", $authUser['login']);
            $stmt->execute();
            $result = $stmt->get_result();
        }

        if (!$result) api_response(array('error' => 'Ошибка запроса'), 500);

        $tasks = array();
        while ($row = $result->fetch_assoc()) {
            $tasks[] = $row;
        }
        api_response($tasks);
    }

    if ($method === 'POST') {
        if ($authUser['role'] !== 'admin') {
            api_response(array('error' => 'Доступ запрещен'), 403);
        }

        $input = file_get_contents('php://input');
        $data  = json_decode($input, true);

        $title          = isset($data['title'])       ? $data['title']       : '';
        $description    = isset($data['description']) ? $data['description'] : '';
        $executor       = isset($data['executor'])    ? $data['executor']    : '';
        $requiredPhotos = isset($data['photosCount']) ? (int)$data['photosCount'] : 0;
        $status         = 'pending';

        if (empty($title)) api_response(array('error' => 'Название обязательно'), 400);

        $stmt = $mysql->prepare(
            "INSERT INTO tasks (title, description, executor, required_photos, photos_count, status) VALUES (?, ?, ?, ?, 0, ?)"
        );
        if (!$stmt) api_response(array('error' => 'Ошибка prepare: ' . $mysql->error), 500);

        $stmt->bind_param("sssis", $title, $description, $executor, $requiredPhotos, $status);
        $stmt->execute();

        api_response(array('success' => true, 'id' => $mysql->insert_id), 201);
    }

    if ($method === 'PUT' && $id !== null) {
        $input = file_get_contents('php://input');
        $data  = json_decode($input, true);

        $allowedStatuses = array('pending', 'review', 'completed', 'rejected');
        $keys = array_keys($data);
        $onlyStatus = (count($keys) === 1 && isset($data['status']));

        if ($onlyStatus) {
            $status = $data['status'];
            if (!in_array($status, $allowedStatuses)) {
                api_response(array('error' => 'Недопустимый статус'), 400);
            }
            if ($authUser['role'] === 'worker' && !in_array($status, array('review', 'pending'))) {
                api_response(array('error' => 'Доступ запрещен'), 403);
            }
            if (in_array($status, array('completed', 'rejected')) && $authUser['role'] !== 'admin') {
                api_response(array('error' => 'Доступ запрещен'), 403);
            }
            $stmt = $mysql->prepare("UPDATE tasks SET status = ? WHERE id = ?");
            $stmt->bind_param("si", $status, $id);
            $stmt->execute();
            api_response(array('success' => true));
        }

    
        if ($authUser['role'] !== 'admin') {
            api_response(array('error' => 'Доступ запрещен'), 403);
        }

        if (isset($data['status']) && $data['status'] === 'rejected' && isset($data['rejection_reason'])) {
            $reason = $data['rejection_reason'];
            $status = 'rejected';
            $stmt = $mysql->prepare("UPDATE tasks SET status = ?, rejection_reason = ? WHERE id = ?");
            $stmt->bind_param("ssi", $status, $reason, $id);
            $stmt->execute();
            api_response(array('success' => true));
        }

     
        $title           = isset($data['title'])            ? $data['title']               : '';
        $description     = isset($data['description'])      ? $data['description']         : '';
        $executor        = isset($data['executor'])         ? $data['executor']            : '';
        $requiredPhotos  = isset($data['requiredPhotos'])   ? (int)$data['requiredPhotos'] : 0;
        $newStatus       = isset($data['status'])           ? $data['status']              : 'pending';
        $rejectionReason = isset($data['rejection_reason']) ? $data['rejection_reason']    : null;

        if (empty($title)) api_response(array('error' => 'Название обязательно'), 400);
        if (!in_array($newStatus, $allowedStatuses)) $newStatus = 'pending';

        $stmt = $mysql->prepare(
            "UPDATE tasks SET title = ?, description = ?, executor = ?, required_photos = ?, status = ?, rejection_reason = ? WHERE id = ?"
        );
        if (!$stmt) api_response(array('error' => 'Ошибка prepare: ' . $mysql->error), 500);

        $stmt->bind_param("sssissi", $title, $description, $executor, $requiredPhotos, $newStatus, $rejectionReason, $id);
        $stmt->execute();
        api_response(array('success' => true));
    }

    if ($method === 'DELETE' && $id !== null) {
        if ($authUser['role'] !== 'admin') {
            api_response(array('error' => 'Доступ запрещен'), 403);
        }

        $stmt = $mysql->prepare("DELETE FROM tasks WHERE id = ?");
        if (!$stmt) api_response(array('error' => 'Ошибка prepare'), 500);

        $stmt->bind_param("i", $id);
        $stmt->execute();
        api_response(array('success' => true));
    }

    api_response(array('error' => 'Метод не разрешен'), 405);
}


elseif ($action === 'users') {

    if ($method === 'GET') {
        $result = $mysql->query("SELECT id, login, name, role FROM users ORDER BY id ASC");
        if (!$result) api_response(array('error' => 'Ошибка запроса'), 500);

        $users = array();
        while ($row = $result->fetch_assoc()) {
            $users[] = $row;
        }
        api_response($users);
    }

    if ($method === 'POST') {
        if ($authUser['role'] !== 'admin') {
            api_response(array('error' => 'Доступ запрещен'), 403);
        }

        $input = file_get_contents('php://input');
        $data  = json_decode($input, true);

        $login    = isset($data['login'])    ? trim($data['login'])    : '';
        $name     = isset($data['name'])     ? trim($data['name'])     : '';
        $password = isset($data['password']) ? $data['password']       : '';
        $role     = isset($data['role'])     ? $data['role']           : 'worker';

        if (empty($login) || empty($name) || empty($password)) {
            api_response(array('error' => 'Логин, имя и пароль обязательны'), 400);
        }

        if (!in_array($role, array('admin', 'worker'))) {
            $role = 'worker';
        }

        $stmt = $mysql->prepare("SELECT id FROM users WHERE login = ?");
        $stmt->bind_param("s", $login);
        $stmt->execute();
        $existing = $stmt->get_result()->fetch_assoc();

        if ($existing) {
            api_response(array('error' => 'Пользователь с таким логином уже существует'), 400);
        }

        $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

        $stmt2 = $mysql->prepare("INSERT INTO users (login, name, password, role) VALUES (?, ?, ?, ?)");
        if (!$stmt2) api_response(array('error' => 'Ошибка prepare: ' . $mysql->error), 500);

        $stmt2->bind_param("ssss", $login, $name, $hashedPassword, $role);
        $stmt2->execute();

        api_response(array('success' => true, 'id' => $mysql->insert_id), 201);
    }

    if ($method === 'DELETE' && $id !== null) {
        if ($authUser['role'] !== 'admin') {
            api_response(array('error' => 'Доступ запрещен'), 403);
        }

        if ($id == $authUser['id']) {
            api_response(array('error' => 'Нельзя удалить себя'), 400);
        }

        $stmt = $mysql->prepare("DELETE FROM users WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        api_response(array('success' => true));
    }

    api_response(array('error' => 'Метод не разрешен'), 405);
}

// --- ФОТОГРАФИИ ---
elseif ($action === 'photos') {

    if ($method === 'GET' && $id !== null) {
        $stmt = $mysql->prepare("SELECT * FROM task_photos WHERE task_id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $result = $stmt->get_result();

        $photos = array();
        while ($row = $result->fetch_assoc()) {
            $photos[] = $row;
        }
        api_response($photos);
    }

    if ($method === 'POST') {
        $taskId = isset($_POST['task_id']) ? (int)$_POST['task_id'] : null;

        if (!$taskId || !isset($_FILES['photo'])) {
            api_response(array('error' => 'Нет файла или task_id'), 400);
        }

        $file         = $_FILES['photo'];
        $allowedTypes = array('image/jpeg', 'image/png', 'image/jpg');

        if (!in_array($file['type'], $allowedTypes)) api_response(array('error' => 'Неверный тип файла'), 400);
        if ($file['size'] > 5 * 1024 * 1024) api_response(array('error' => 'Файл слишком большой'), 400);

        $stmt = $mysql->prepare("SELECT photos_count, required_photos FROM tasks WHERE id = ?");
        $stmt->bind_param("i", $taskId);
        $stmt->execute();
        $taskData = $stmt->get_result()->fetch_assoc();

        if ($taskData && $taskData['photos_count'] >= $taskData['required_photos']) {
            api_response(array('error' => 'Достигнут лимит фотографий'), 400);
        }

        $uploadDir = __DIR__ . '/uploads/';
        if (!is_dir($uploadDir)) mkdir($uploadDir, 0755, true);

        $ext      = pathinfo($file['name'], PATHINFO_EXTENSION);
        $filename = uniqid() . '.' . $ext;
        $filepath = $uploadDir . $filename;

        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            api_response(array('error' => 'Ошибка сохранения файла'), 500);
        }

        $url  = 'https://buildphotoapp.ru/backend/uploads/' . $filename;
        $stmt = $mysql->prepare("INSERT INTO task_photos (task_id, url) VALUES (?, ?)");
        $stmt->bind_param("is", $taskId, $url);
        $stmt->execute();
        $photoId = $mysql->insert_id;

        $stmt2 = $mysql->prepare("UPDATE tasks SET photos_count = photos_count + 1 WHERE id = ?");
        $stmt2->bind_param("i", $taskId);
        $stmt2->execute();

        api_response(array('id' => $photoId, 'url' => $url, 'task_id' => $taskId));
    }

    if ($method === 'DELETE' && $id !== null) {
        $stmt = $mysql->prepare("SELECT url, task_id FROM task_photos WHERE id = ?");
        $stmt->bind_param("i", $id);
        $stmt->execute();
        $photo = $stmt->get_result()->fetch_assoc();

        if ($photo) {
            $filename = basename($photo['url']);
            $filepath = __DIR__ . '/uploads/' . $filename;
            if (file_exists($filepath)) unlink($filepath);

            $stmt2 = $mysql->prepare("DELETE FROM task_photos WHERE id = ?");
            $stmt2->bind_param("i", $id);
            $stmt2->execute();

            $taskId = $photo['task_id'];
            $stmt3  = $mysql->prepare("UPDATE tasks SET photos_count = GREATEST(photos_count - 1, 0) WHERE id = ?");
            $stmt3->bind_param("i", $taskId);
            $stmt3->execute();
        }

        api_response(array('success' => true));
    }

    api_response(array('error' => 'Метод не разрешен'), 405);
}

else {
    api_response(array('error' => 'Ресурс не найден'), 404);
}
?>