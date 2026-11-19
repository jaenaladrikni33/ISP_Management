<?php
declare(strict_types=1);

final class ApiException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 400)
    {
        parent::__construct($message);
    }
}

function respond(array $body, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 400): never
{
    throw new ApiException($message, $status);
}

function readBody(): array
{
    $contentType = strtolower((string)($_SERVER['CONTENT_TYPE'] ?? ''));
    if (str_starts_with($contentType, 'multipart/form-data')) {
        return [];
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $body = json_decode($raw, true);
    if (!is_array($body)) {
        fail('Request body must be valid JSON.');
    }

    return $body;
}

function readUploadedImage(): array
{
    $file = $_FILES['file'] ?? null;
    if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        fail('Pilih file gambar yang valid.');
    }
    if (($file['size'] ?? 0) > 5 * 1024 * 1024) {
        fail('Ukuran foto maksimal 5 MB.');
    }

    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) {
        fail('Format foto harus JPG, PNG, atau WebP.');
    }
    $data = file_get_contents($file['tmp_name']);
    if ($data === false) {
        fail('File gambar tidak dapat dibaca.');
    }

    return ['mime_type' => $mime, 'data' => $data];
}

function dbConfig(): array
{
    $sourceRoot = dirname(__DIR__, 2);
    $path = is_file($sourceRoot . '/vite.config.js')
        ? $sourceRoot . '/config.local.php'
        : dirname(__DIR__) . '/config.local.php';
    if (!is_file($path)) {
        fail('Database belum dikonfigurasi. Salin api/config.example.php menjadi config.local.php.', 503);
    }

    $config = require $path;
    if (!is_array($config) || empty($config['db_name']) || !array_key_exists('db_password', $config)) {
        fail('Konfigurasi database tidak lengkap.', 503);
    }

    return $config;
}

function database(): PDO
{
    static $connection;
    if ($connection instanceof PDO) {
        return $connection;
    }

    $config = dbConfig();
    $host = $config['db_host'] ?? '127.0.0.1';
    $port = (int)($config['db_port'] ?? 3306);
    $name = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$config['db_name']);
    if ($name === '') {
        fail('Nama database tidak valid.', 503);
    }

    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    $connection = new PDO($dsn, (string)($config['db_user'] ?? ''), (string)$config['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    $connection->exec(
        'CREATE TABLE IF NOT EXISTS app_users (
            id CHAR(36) NOT NULL PRIMARY KEY,
            email VARCHAR(254) NOT NULL UNIQUE,
            full_name VARCHAR(120) NOT NULL DEFAULT \'\',
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT \'user\',
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            created_date DATETIME NOT NULL,
            updated_date DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $connection->exec(
        'CREATE TABLE IF NOT EXISTS entity_records (
            entity VARCHAR(80) NOT NULL,
            id CHAR(36) NOT NULL,
            data LONGTEXT NOT NULL,
            created_date DATETIME NOT NULL,
            updated_date DATETIME NOT NULL,
            PRIMARY KEY (entity, id),
            KEY entity_created (entity, created_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $connection->exec(
        'CREATE TABLE IF NOT EXISTS password_resets (
            token_hash CHAR(64) NOT NULL PRIMARY KEY,
            user_id CHAR(36) NOT NULL,
            expires_at DATETIME NOT NULL,
            KEY reset_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );
    $connection->exec(
        'CREATE TABLE IF NOT EXISTS private_files (
            id CHAR(36) NOT NULL PRIMARY KEY,
            owner_id CHAR(36) NOT NULL,
            mime_type VARCHAR(80) NOT NULL,
            file_data LONGBLOB NOT NULL,
            created_date DATETIME NOT NULL,
            KEY file_owner (owner_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    );

    return $connection;
}

function now(): string
{
    return gmdate('Y-m-d H:i:s');
}

function uuid(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4) . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
}

function startSession(): void
{
    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_set_cookie_params([
        'httponly' => true,
        'secure' => $secure,
        'samesite' => 'Lax',
        'path' => '/',
    ]);
    session_start();
}

function checkOrigin(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }

    $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
    $expected = ($secure ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? '');
    if (!hash_equals($expected, rtrim($origin, '/'))) {
        fail('Permintaan lintas domain ditolak.', 403);
    }
}

function publicUser(array $row): array
{
    return [
        'id' => $row['id'],
        'email' => $row['email'],
        'full_name' => $row['full_name'],
        'role' => $row['role'],
        'created_date' => $row['created_date'],
    ];
}

function settingRecord(PDO $db): array
{
    $statement = $db->prepare('SELECT id, data, created_date, updated_date FROM entity_records WHERE entity = ? ORDER BY created_date ASC LIMIT 1');
    $statement->execute(['AppSetting']);
    $record = $statement->fetch();
    if ($record) {
        return json_decode($record['data'], true) ?: [];
    }

    if ((int)$db->query("SELECT GET_LOCK('isp_management_default_settings', 5)")->fetchColumn() !== 1) {
        fail('Pengaturan aplikasi sedang dibuat. Coba lagi.', 503);
    }

    try {
        $statement->execute(['AppSetting']);
        $record = $statement->fetch();
        if ($record) {
            return json_decode($record['data'], true) ?: [];
        }

        $id = uuid();
        $timestamp = now();
        $defaults = [
            'id' => $id,
            'company_name' => 'ISP_Management',
            'default_cv_percentage' => 70,
            'default_due_days' => 10,
            'cv_pusat_pct' => 30,
            'cv_mitra_pct' => 70,
            'cv_pph23_pct' => 2,
            'expense_categories' => [],
            'income_categories' => [],
            'user_roles' => (object)[],
            'user_status' => (object)[],
            'biller_menus' => ['/', '/pelanggan', '/tagihan'],
            'teknisi_menus' => ['/', '/pelanggan'],
            'rekening_aktual' => 0,
            'teknisi_komisi_enabled' => true,
            'teknisi_komisi_pct' => 10,
            'created_date' => $timestamp,
            'updated_date' => $timestamp,
        ];
        $insert = $db->prepare('INSERT INTO entity_records (entity, id, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)');
        $insert->execute(['AppSetting', $id, json_encode($defaults, JSON_UNESCAPED_UNICODE), $timestamp, $timestamp]);
        return $defaults;
    } finally {
        $db->query("SELECT RELEASE_LOCK('isp_management_default_settings')");
    }
}

function currentUser(PDO $db, bool $required = true): ?array
{
    $id = $_SESSION['user_id'] ?? '';
    if ($id === '') {
        if ($required) {
            fail('Silakan masuk terlebih dahulu.', 401);
        }
        return null;
    }

    $statement = $db->prepare('SELECT id, email, full_name, role, is_active, created_date FROM app_users WHERE id = ?');
    $statement->execute([$id]);
    $user = $statement->fetch();
    if (!$user || !(int)$user['is_active']) {
        $_SESSION = [];
        session_regenerate_id(true);
        if ($required) {
            fail('Akun tidak aktif atau sesi sudah berakhir.', 401);
        }
        return null;
    }

    if ($user['role'] !== 'admin') {
        $settings = settingRecord($db);
        if (($settings['user_status'][$user['email']] ?? 'aktif') !== 'aktif') {
            $_SESSION = [];
            session_regenerate_id(true);
            if ($required) {
                fail('Akun Anda dinonaktifkan oleh administrator.', 403);
            }
            return null;
        }
    }

    return publicUser($user);
}

function effectiveRole(PDO $db, array $user): string
{
    if ($user['role'] === 'admin') {
        return 'admin';
    }
    $settings = settingRecord($db);
    return $settings['user_roles'][$user['email']] ?? 'user';
}

function requireAdmin(PDO $db, array $user): void
{
    if (effectiveRole($db, $user) !== 'admin') {
        fail('Akses hanya untuk administrator.', 403);
    }
}

function ensureDefaultSettings(PDO $db): void
{
    settingRecord($db);
}

function entityNames(): array
{
    return [
        'AppSetting', 'BroadcastLog', 'CVDeposit', 'CVPayout', 'Customer',
        'Expense', 'Income', 'Invoice', 'Package', 'Payment',
        'TechnicianReport', 'User', 'WhatsAppLog',
    ];
}

function validateEntity(string $entity): void
{
    if (!in_array($entity, entityNames(), true)) {
        fail('Jenis data tidak dikenal.', 404);
    }
}

function userRows(PDO $db): array
{
    $rows = $db->query('SELECT id, email, full_name, role, created_date FROM app_users ORDER BY created_date ASC')->fetchAll();
    return array_map('publicUser', $rows);
}

function recordRows(PDO $db, string $entity): array
{
    if ($entity === 'AppSetting') {
        ensureDefaultSettings($db);
    }
    $statement = $db->prepare('SELECT data FROM entity_records WHERE entity = ?');
    $statement->execute([$entity]);
    $rows = [];
    foreach ($statement->fetchAll() as $row) {
        $data = json_decode($row['data'], true);
        if (is_array($data)) {
            $rows[] = $data;
        }
    }
    return $rows;
}

function ownsTechnicianRecord(array $record, array $user, string $role): bool
{
    return $role === 'admin' || ($record['technician_email'] ?? '') === $user['email'];
}

function assertEntityPermissions(PDO $db, array $user, string $entity, string $method): void
{
    $role = effectiveRole($db, $user);
    if ($role === 'admin' || $role === 'user') {
        return;
    }

    $readable = [
        'biller' => ['AppSetting', 'BroadcastLog', 'CVDeposit', 'CVPayout', 'Customer', 'Invoice', 'Package', 'Payment', 'TechnicianReport', 'WhatsAppLog'],
        'teknisi' => ['AppSetting', 'CVDeposit', 'CVPayout', 'Customer', 'Expense', 'Income', 'Invoice', 'Payment', 'TechnicianReport'],
    ];
    if (!in_array($entity, $readable[$role] ?? [], true)) {
        fail('Peran Anda tidak diizinkan mengakses data ini.', 403);
    }

    if ($method === 'GET') {
        return;
    }
    if ($role === 'teknisi' && $entity === 'TechnicianReport' && $method === 'POST') {
        return;
    }
    $writable = [
        'biller' => ['BroadcastLog', 'CVDeposit', 'Customer', 'Invoice', 'Payment', 'WhatsAppLog'],
        'teknisi' => [],
    ];
    if (!in_array($entity, $writable[$role] ?? [], true)) {
        fail('Peran Anda tidak diizinkan mengubah data ini.', 403);
    }
}

function matchesFilter(array $record, array $filter): bool
{
    foreach ($filter as $field => $expected) {
        if (!array_key_exists($field, $record)) {
            return false;
        }
        $actual = $record[$field];
        if (is_scalar($actual) && is_scalar($expected)) {
            if ((string)$actual !== (string)$expected) {
                return false;
            }
        } elseif ($actual !== $expected) {
            return false;
        }
    }
    return true;
}

function entityResponse(PDO $db, string $entity, array $user, array $filter, string $sort, int $limit): array
{
    validateEntity($entity);
    if ($entity === 'User') {
        requireAdmin($db, $user);
        $rows = userRows($db);
    } else {
        $rows = recordRows($db, $entity);
    }

    if ($entity === 'TechnicianReport') {
        $role = effectiveRole($db, $user);
        $rows = array_values(array_filter($rows, fn(array $row): bool => ownsTechnicianRecord($row, $user, $role)));
    }
    if ($filter) {
        $rows = array_values(array_filter($rows, fn(array $row): bool => matchesFilter($row, $filter)));
    }
    if ($sort !== '') {
        $descending = str_starts_with($sort, '-');
        $field = $descending ? substr($sort, 1) : $sort;
        usort($rows, static function (array $left, array $right) use ($field, $descending): int {
            $a = $left[$field] ?? null;
            $b = $right[$field] ?? null;
            $comparison = is_numeric($a) && is_numeric($b) ? ($a <=> $b) : strnatcasecmp((string)$a, (string)$b);
            return $descending ? -$comparison : $comparison;
        });
    }
    return array_slice($rows, 0, max(1, min($limit, 10000)));
}

function saveEntity(PDO $db, string $entity, array $record, ?string $id = null): array
{
    $isNew = $id === null;
    $timestamp = now();
    if ($isNew) {
        $id = uuid();
    }
    $record['id'] = $id;
    $record['created_date'] = $record['created_date'] ?? $timestamp;
    $record['updated_date'] = $timestamp;
    $json = json_encode($record, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        fail('Data tidak dapat disimpan.');
    }

    if ($isNew) {
        $statement = $db->prepare('INSERT INTO entity_records (entity, id, data, created_date, updated_date) VALUES (?, ?, ?, ?, ?)');
        $statement->execute([$entity, $id, $json, $timestamp, $timestamp]);
    } else {
        $statement = $db->prepare('UPDATE entity_records SET data = ?, updated_date = ? WHERE entity = ? AND id = ?');
        $statement->execute([$json, $timestamp, $entity, $id]);
        if ($statement->rowCount() === 0) {
            $exists = $db->prepare('SELECT 1 FROM entity_records WHERE entity = ? AND id = ?');
            $exists->execute([$entity, $id]);
            if (!$exists->fetchColumn()) {
                fail('Data tidak ditemukan.', 404);
            }
        }
    }

    return $record;
}

function getEntityRecord(PDO $db, string $entity, string $id, array $user): array
{
    if ($entity === 'User') {
        requireAdmin($db, $user);
        $statement = $db->prepare('SELECT id, email, full_name, role, created_date FROM app_users WHERE id = ?');
        $statement->execute([$id]);
        $row = $statement->fetch();
        if (!$row) {
            fail('Data tidak ditemukan.', 404);
        }
        return publicUser($row);
    }
    $statement = $db->prepare('SELECT data FROM entity_records WHERE entity = ? AND id = ?');
    $statement->execute([$entity, $id]);
    $row = $statement->fetch();
    if (!$row) {
        fail('Data tidak ditemukan.', 404);
    }
    $record = json_decode($row['data'], true) ?: [];
    if ($entity === 'TechnicianReport' && !ownsTechnicianRecord($record, $user, effectiveRole($db, $user))) {
        fail('Akses ditolak.', 403);
    }
    return $record;
}

function createAccount(PDO $db, string $email, string $password, string $fullName = '', bool $firstRegistrationOnly = false): array
{
    $email = strtolower(trim($email));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
        fail('Alamat email tidak valid.');
    }
    if (strlen($password) < 8) {
        fail('Kata sandi harus memiliki minimal 8 karakter.');
    }
    if ((int)$db->query("SELECT GET_LOCK('isp_management_account_creation', 5)")->fetchColumn() !== 1) {
        fail('Tidak dapat membuat akun sekarang. Coba lagi.', 503);
    }

    try {
        $db->beginTransaction();
        $exists = $db->prepare('SELECT 1 FROM app_users WHERE email = ?');
        $exists->execute([$email]);
        if ($exists->fetchColumn()) {
            $db->rollBack();
            fail('Email tersebut sudah terdaftar.', 409);
        }

        $userCount = (int)$db->query('SELECT COUNT(*) FROM app_users')->fetchColumn();
        if ($firstRegistrationOnly && $userCount > 0) {
            $db->rollBack();
            fail('Pendaftaran mandiri sudah ditutup. Hubungi administrator untuk membuat akun.', 403);
        }
        $role = $userCount === 0 ? 'admin' : 'user';
        $id = uuid();
        $timestamp = now();
        $insert = $db->prepare('INSERT INTO app_users (id, email, full_name, password_hash, role, is_active, created_date, updated_date) VALUES (?, ?, ?, ?, ?, 1, ?, ?)');
        $insert->execute([$id, $email, trim($fullName), password_hash($password, PASSWORD_DEFAULT), $role, $timestamp, $timestamp]);
        $db->commit();
        return [
            'id' => $id,
            'email' => $email,
            'full_name' => trim($fullName),
            'role' => $role,
            'created_date' => $timestamp,
        ];
    } catch (Throwable $error) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $error;
    } finally {
        $db->query("SELECT RELEASE_LOCK('isp_management_account_creation')");
    }
}

function sendPasswordReset(PDO $db, array $config, string $email): void
{
    $email = strtolower(trim($email));
    $statement = $db->prepare('SELECT id FROM app_users WHERE email = ? AND is_active = 1');
    $statement->execute([$email]);
    $userId = $statement->fetchColumn();
    if (!$userId) {
        return;
    }

    $token = bin2hex(random_bytes(32));
    $insert = $db->prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)');
    $insert->execute([hash('sha256', $token), $userId, gmdate('Y-m-d H:i:s', time() + 3600)]);
    $appUrl = rtrim((string)($config['app_url'] ?? ''), '/');
    if ($appUrl === '') {
        fail('APP_URL belum diatur pada config.local.php.', 503);
    }
    $link = $appUrl . '/reset-password?token=' . rawurlencode($token);
    $subject = 'Atur ulang kata sandi ISP_Management';
    $message = "Gunakan tautan berikut untuk mengatur ulang kata sandi (berlaku 1 jam):\n\n{$link}\n";
    $headers = 'From: ' . (string)($config['mail_from'] ?? 'noreply@example.com');
    if (!mail($email, $subject, $message, $headers)) {
        fail('Email gagal dikirim. Periksa konfigurasi email pada server PHP.', 503);
    }
}

function routeRequest(): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        checkOrigin();
    }
    if ($method === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    $route = trim((string)($_GET['route'] ?? ''), '/');
    $segments = $route === '' ? [] : explode('/', $route);
    $db = database();
    $body = in_array($method, ['POST', 'PUT', 'PATCH'], true) ? readBody() : [];

    if ($route === 'health' && $method === 'GET') {
        respond(['ok' => true]);
    }
    if ($route === 'settings' && $method === 'GET') {
        $settings = settingRecord($db);
        respond([
            'id' => 'local',
            'public_settings' => [
                'company_name' => $settings['company_name'] ?? 'ISP_Management',
                'company_logo_file_id' => $settings['company_logo_file_id'] ?? null,
            ],
        ]);
    }

    if ($route === 'branding/logo') {
        if ($method === 'GET') {
            $settings = settingRecord($db);
            $fileId = (string)($settings['company_logo_file_id'] ?? '');
            if ($fileId === '') {
                fail('Logo perusahaan belum diatur.', 404);
            }
            $statement = $db->prepare('SELECT mime_type, file_data FROM private_files WHERE id = ?');
            $statement->execute([$fileId]);
            $file = $statement->fetch();
            if (!$file) {
                fail('Logo perusahaan tidak ditemukan.', 404);
            }
            header('Content-Type: ' . $file['mime_type']);
            header('X-Content-Type-Options: nosniff');
            header('Cache-Control: no-store');
            $content = $file['file_data'];
            echo is_resource($content) ? stream_get_contents($content) : $content;
            exit;
        }

        if ($method === 'POST') {
            $user = currentUser($db);
            requireAdmin($db, $user);
            $image = readUploadedImage();
            $settings = settingRecord($db);
            $oldFileId = (string)($settings['company_logo_file_id'] ?? '');
            $fileId = uuid();

            $db->beginTransaction();
            try {
                $insert = $db->prepare('INSERT INTO private_files (id, owner_id, mime_type, file_data, created_date) VALUES (?, ?, ?, ?, ?)');
                $insert->bindValue(1, $fileId);
                $insert->bindValue(2, $user['id']);
                $insert->bindValue(3, $image['mime_type']);
                $insert->bindValue(4, $image['data'], PDO::PARAM_LOB);
                $insert->bindValue(5, now());
                $insert->execute();

                $settings['company_logo_file_id'] = $fileId;
                saveEntity($db, 'AppSetting', $settings, (string)$settings['id']);
                if ($oldFileId !== '' && $oldFileId !== $fileId) {
                    $delete = $db->prepare('DELETE FROM private_files WHERE id = ?');
                    $delete->execute([$oldFileId]);
                }
                $db->commit();
            } catch (Throwable $error) {
                if ($db->inTransaction()) {
                    $db->rollBack();
                }
                throw $error;
            }

            respond(['company_logo_file_id' => $fileId], 201);
        }
    }

    if (($segments[0] ?? '') === 'auth') {
        $action = $segments[1] ?? '';
        if ($action === 'register' && $method === 'POST') {
            $user = createAccount($db, (string)($body['email'] ?? ''), (string)($body['password'] ?? ''), (string)($body['full_name'] ?? ''), true);
            session_regenerate_id(true);
            $_SESSION['user_id'] = $user['id'];
            respond(['user' => $user], 201);
        }
        if ($action === 'login' && $method === 'POST') {
            $email = strtolower(trim((string)($body['email'] ?? '')));
            $statement = $db->prepare('SELECT id, email, full_name, password_hash, role, is_active, created_date FROM app_users WHERE email = ?');
            $statement->execute([$email]);
            $row = $statement->fetch();
            if (!$row || !password_verify((string)($body['password'] ?? ''), $row['password_hash'])) {
                fail('Email atau kata sandi salah.', 401);
            }
            if (!(int)$row['is_active']) {
                fail('Akun tidak aktif. Hubungi administrator.', 403);
            }
            session_regenerate_id(true);
            $_SESSION['user_id'] = $row['id'];
            $user = publicUser($row);
            currentUser($db);
            respond(['user' => $user]);
        }
        if ($action === 'me' && $method === 'GET') {
            respond(['user' => currentUser($db)]);
        }
        if ($action === 'logout' && $method === 'POST') {
            $_SESSION = [];
            if (ini_get('session.use_cookies')) {
                $params = session_get_cookie_params();
                setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool)$params['secure'], (bool)$params['httponly']);
            }
            session_destroy();
            respond(['ok' => true]);
        }
        if ($action === 'forgot-password' && $method === 'POST') {
            sendPasswordReset($db, dbConfig(), (string)($body['email'] ?? ''));
            respond(['ok' => true]);
        }
        if ($action === 'reset-password' && $method === 'POST') {
            $token = (string)($body['token'] ?? '');
            $password = (string)($body['password'] ?? '');
            if (strlen($password) < 8) {
                fail('Kata sandi harus memiliki minimal 8 karakter.');
            }
            $db->beginTransaction();
            $statement = $db->prepare('SELECT user_id FROM password_resets WHERE token_hash = ? AND expires_at > ? FOR UPDATE');
            $statement->execute([hash('sha256', $token), now()]);
            $userId = $statement->fetchColumn();
            if (!$userId) {
                $db->rollBack();
                fail('Tautan reset kata sandi tidak valid atau kedaluwarsa.', 400);
            }
            $update = $db->prepare('UPDATE app_users SET password_hash = ?, updated_date = ? WHERE id = ?');
            $update->execute([password_hash($password, PASSWORD_DEFAULT), now(), $userId]);
            $delete = $db->prepare('DELETE FROM password_resets WHERE user_id = ?');
            $delete->execute([$userId]);
            $db->commit();
            respond(['ok' => true]);
        }
    }

    if (($segments[0] ?? '') === 'users' && ($segments[1] ?? '') === 'invite' && $method === 'POST') {
        $user = currentUser($db);
        requireAdmin($db, $user);
        $temporaryPassword = rtrim(strtr(base64_encode(random_bytes(12)), '+/', '-_'), '=');
        $created = createAccount($db, (string)($body['email'] ?? ''), $temporaryPassword);
        respond(['user' => $created, 'temporary_password' => $temporaryPassword], 201);
    }

    if (($segments[0] ?? '') === 'files') {
        $user = currentUser($db);
        if (count($segments) === 1 && $method === 'POST') {
            $image = readUploadedImage();
            $id = uuid();
            $statement = $db->prepare('INSERT INTO private_files (id, owner_id, mime_type, file_data, created_date) VALUES (?, ?, ?, ?, ?)');
            $statement->bindValue(1, $id);
            $statement->bindValue(2, $user['id']);
            $statement->bindValue(3, $image['mime_type']);
            $statement->bindValue(4, $image['data'], PDO::PARAM_LOB);
            $statement->bindValue(5, now());
            $statement->execute();
            respond(['file_uri' => '/api/files/' . $id], 201);
        }
        if (count($segments) === 2 && $method === 'GET') {
            $statement = $db->prepare('SELECT owner_id, mime_type, file_data FROM private_files WHERE id = ?');
            $statement->execute([$segments[1]]);
            $file = $statement->fetch();
            if (!$file) {
                fail('File tidak ditemukan.', 404);
            }
            if ($file['owner_id'] !== $user['id'] && effectiveRole($db, $user) !== 'admin') {
                fail('Akses file ditolak.', 403);
            }
            header('Content-Type: ' . $file['mime_type']);
            header('X-Content-Type-Options: nosniff');
            header('Cache-Control: private, no-store');
            $content = $file['file_data'];
            echo is_resource($content) ? stream_get_contents($content) : $content;
            exit;
        }
    }

    if (($segments[0] ?? '') === 'entities' && isset($segments[1])) {
        $entity = $segments[1];
        validateEntity($entity);
        $user = currentUser($db);
        $id = $segments[2] ?? null;
        assertEntityPermissions($db, $user, $entity, $method);

        if ($entity === 'AppSetting' && in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
            requireAdmin($db, $user);
        }

        if ($id === null && $method === 'GET') {
            $filter = [];
            if (isset($_GET['filter'])) {
                $filter = json_decode((string)$_GET['filter'], true);
                if (!is_array($filter)) {
                    fail('Filter data tidak valid.');
                }
            }
            $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 1000;
            $sort = (string)($_GET['sort'] ?? '');
            respond(['data' => entityResponse($db, $entity, $user, $filter, $sort, $limit)]);
        }

        if ($id === 'bulk' && $method === 'POST') {
            if ($entity === 'User' || $entity === 'AppSetting') {
                fail('Operasi banyak data tidak tersedia untuk jenis data ini.', 405);
            }
            $records = $body['records'] ?? null;
            if (!is_array($records) || count($records) > 1000) {
                fail('Daftar data tidak valid.');
            }
            $db->beginTransaction();
            $saved = [];
            foreach ($records as $record) {
                if (!is_array($record)) {
                    $db->rollBack();
                    fail('Setiap baris harus berupa objek.');
                }
                if ($entity === 'TechnicianReport' && effectiveRole($db, $user) !== 'admin') {
                    $record['technician_email'] = $user['email'];
                    $record['technician_name'] = $user['full_name'] ?: $user['email'];
                }
                $saved[] = saveEntity($db, $entity, $record);
            }
            $db->commit();
            respond(['data' => $saved], 201);
        }

        if ($id !== null && $method === 'GET') {
            respond(['data' => getEntityRecord($db, $entity, $id, $user)]);
        }
        if ($id !== null && in_array($method, ['PUT', 'PATCH'], true)) {
            if ($entity === 'User') {
                fail('Akun hanya dapat dikelola melalui fitur pengguna.', 405);
            }
            $existing = getEntityRecord($db, $entity, $id, $user);
            $saved = saveEntity($db, $entity, array_merge($existing, $body), $id);
            respond(['data' => $saved]);
        }
        if ($id !== null && $method === 'DELETE') {
            if ($entity === 'User') {
                requireAdmin($db, $user);
                $statement = $db->prepare('SELECT role FROM app_users WHERE id = ?');
                $statement->execute([$id]);
                $role = $statement->fetchColumn();
                if (!$role) {
                    fail('Pengguna tidak ditemukan.', 404);
                }
                if ($role === 'admin' || $id === $user['id']) {
                    fail('Akun administrator tidak dapat dihapus.', 403);
                }
                $delete = $db->prepare('DELETE FROM app_users WHERE id = ?');
                $delete->execute([$id]);
                respond(['ok' => true]);
            }
            getEntityRecord($db, $entity, $id, $user);
            $delete = $db->prepare('DELETE FROM entity_records WHERE entity = ? AND id = ?');
            $delete->execute([$entity, $id]);
            respond(['ok' => true]);
        }
        if ($id === null && $method === 'POST') {
            if ($entity === 'User') {
                fail('Gunakan fitur undang pengguna.', 405);
            }
            if ($entity === 'TechnicianReport' && effectiveRole($db, $user) !== 'admin') {
                $body['technician_email'] = $user['email'];
                $body['technician_name'] = $user['full_name'] ?: $user['email'];
            }
            respond(['data' => saveEntity($db, $entity, $body)], 201);
        }
    }

    fail('Endpoint tidak ditemukan.', 404);
}

set_exception_handler(static function (Throwable $error): void {
    if ($error instanceof ApiException) {
        respond(['error' => ['message' => $error->getMessage()]], $error->status);
    }
    error_log((string)$error);
    respond(['error' => ['message' => 'Terjadi kesalahan pada server. Periksa log PHP untuk detailnya.']], 500);
});

try {
    startSession();
    routeRequest();
} catch (Throwable $error) {
    if ($error instanceof ApiException) {
        respond(['error' => ['message' => $error->getMessage()]], $error->status);
    }
    error_log((string)$error);
    respond(['error' => ['message' => 'Terjadi kesalahan pada server. Periksa log PHP untuk detailnya.']], 500);
}
