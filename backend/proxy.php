<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");

$file = isset($_GET['file']) ? basename($_GET['file']) : '';
if (empty($file)) { http_response_code(400); exit; }

$path = __DIR__ . '/uploads/' . $file;
if (!file_exists($path)) { http_response_code(404); exit; }

$ext  = strtolower(pathinfo($path, PATHINFO_EXTENSION));
$mime = ($ext === 'png') ? 'image/png' : 'image/jpeg';

header("Content-Type: " . $mime);
header("Content-Length: " . filesize($path));
header("Cache-Control: public, max-age=86400");
readfile($path);