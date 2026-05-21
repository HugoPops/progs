<?php
define('DB_HOST', 'localhost');
define('DB_USER', 'root');      
define('DB_PASSWORD', '');      
define('DB_NAME', 'task_app');

$mysql = new mysqli(DB_HOST, DB_USER, DB_PASSWORD, DB_NAME);

if ($mysql->connect_errno) {
    die(json_encode(['error' => 'Ошибка подключения к БД: ' . $mysql->connect_error]));
}

$mysql->set_charset('utf8');
?>