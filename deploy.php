<?php
/**
 * Deploy endpoint — triggers git pull / server restart.
 * Usage: GET /chess/deploy.php?token=SECRET&target=client|server|both
 */

header('Content-Type: application/json');

// Load secret token
$tokenFile = '/home/bitnami/server/.deploy-token';
if (!is_readable($tokenFile)) {
    http_response_code(500);
    echo json_encode(['error' => 'Deploy token not readable']);
    exit;
}
$expectedToken = trim(file_get_contents($tokenFile));
if (strlen($expectedToken) === 0) {
    http_response_code(500);
    echo json_encode(['error' => 'Deploy token is empty']);
    exit;
}

// Validate token
$providedToken = $_GET['token'] ?? '';
if (strlen($providedToken) === 0 || !hash_equals($expectedToken, $providedToken)) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

// Get target
$target = $_GET['target'] ?? 'client';
if (!in_array($target, ['client', 'server', 'both'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid target. Use: client, server, both']);
    exit;
}

// Run deploy script as bitnami user
$cmd = sprintf(
    'sudo -u bitnami /home/bitnami/server/deploy-run.sh %s 2>&1',
    escapeshellarg($target)
);

$output = shell_exec($cmd);
$lines = array_filter(explode("\n", trim($output)));

// Check if blocked
$blocked = false;
foreach ($lines as $line) {
    if (strpos($line, 'BLOCKED:') === 0) {
        $blocked = true;
        break;
    }
}

if ($blocked) {
    http_response_code(409);
    echo json_encode([
        'status' => 'blocked',
        'message' => 'Client deploy blocked — server version too old',
        'output' => $lines,
    ]);
} else {
    echo json_encode([
        'status' => 'ok',
        'target' => $target,
        'output' => $lines,
    ]);
}
