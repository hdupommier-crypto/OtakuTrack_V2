<?php
// ===== CORS — doit être absolument en premier =====
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header('Access-Control-Allow-Origin: ' . $_SERVER['HTTP_ORIGIN']);
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// ===== CONFIGURATION BASE DE DONNÉES INFINITYFREE =====
define('DB_HOST', 'sql211.infinityfree.com');
define('DB_USER', 'if0_42007210');
define('DB_PASS', 'fODcDIjAnvHwE');
define('DB_NAME', 'if0_42007210_otaku_track');

// ===== CONNEXION =====
function getDB() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    if ($conn->connect_error) {
        http_response_code(500);
        echo json_encode(['error' => 'Connexion échouée: ' . $conn->connect_error]);
        exit;
    }
    $conn->set_charset('utf8mb4');
    return $conn;
}

// ===== ROUTING =====
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get_all':
        getAll();
        break;
    case 'save_all':
        saveAll();
        break;
    case 'status':
        echo json_encode(['ok' => true, 'message' => 'API OtakuTrack opérationnelle sur InfinityFree']);
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Action inconnue']);
}

// ===== RÉCUPÉRER TOUTES LES DONNÉES =====
function getAll() {
    $db = getDB();

    $animes = [];
    $mangas = [];

    // Récupération des animes
    $result = $db->query("SELECT * FROM animes ORDER BY title");
    while ($row = $result->fetch_assoc()) {
        $seasonsData = json_decode($row['seasons'], true);
        
        $animes[] = [
            'id'           => $row['id'],
            'type'         => $row['type'] ?? 'anime',
            'title'        => $row['title'],
            'poster'       => $row['poster'],
            'lastModified' => (int)$row['last_modified'],
            'seasons'      => is_array($seasonsData) ? $seasonsData : []
        ];
    }

    // Récupération des mangas
    $result = $db->query("SELECT * FROM mangas ORDER BY title");
    while ($row = $result->fetch_assoc()) {
        $mangas[] = [
            'id'           => $row['id'],
            'type'         => $row['type'] ?? 'manga',
            'title'        => $row['title'],
            'total'        => (int)$row['total'],
            'read'         => (int)$row['read'], 
            'notes'        => $row['notes'],
            'poster'       => $row['poster'],
            'lastModified' => (int)$row['last_modified']
        ];
    }

    $db->close();
    echo json_encode(['animes' => $animes, 'mangas' => $mangas]);
}

// ===== SAUVEGARDER TOUTES LES DONNÉES =====
function saveAll() {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!$body || !isset($body['animes']) || !isset($body['mangas'])) {
        http_response_code(400);
        echo json_encode(['error' => 'Données invalides']);
        return;
    }

    $db = getDB();
    $db->begin_transaction();

    try {
        // ---- ANIMES ----
        $existing = [];
        $res = $db->query("SELECT id FROM animes");
        while ($r = $res->fetch_assoc()) $existing[$r['id']] = true;

        $incomingIds = array_column($body['animes'], 'id');
        foreach ($existing as $eid => $_) {
            if (!in_array($eid, $incomingIds)) {
                $safe = $db->real_escape_string($eid);
                $db->query("DELETE FROM animes WHERE id = '$safe'");
            }
        }

        foreach ($body['animes'] as $anime) {
            $id           = $db->real_escape_string($anime['id'] ?? '');
            $title        = $db->real_escape_string($anime['title'] ?? '');
            $type         = $db->real_escape_string($anime['type'] ?? 'anime');
            $poster       = $db->real_escape_string($anime['poster'] ?? '');
            $lastModified = (int)($anime['lastModified'] ?? 0);
            
            $seasonsJson  = $db->real_escape_string(json_encode($anime['seasons'] ?? []));

            if (isset($existing[$anime['id']])) {
                $db->query("UPDATE animes SET title='$title', type='$type', seasons='$seasonsJson', poster='$poster', last_modified=$lastModified WHERE id='$id'");
            } else {
                $db->query("INSERT INTO animes (id, title, type, seasons, poster, last_modified) VALUES ('$id','$title','$type','$seasonsJson','$poster',$lastModified)");
            }
        }

        // ---- MANGAS ----
        $existingM = [];
        $res = $db->query("SELECT id FROM mangas");
        while ($r = $res->fetch_assoc()) $existingM[$r['id']] = true;

        $incomingMIds = array_column($body['mangas'], 'id');
        foreach ($existingM as $eid => $_) {
            if (!in_array($eid, $incomingMIds)) {
                $safe = $db->real_escape_string($eid);
                $db->query("DELETE FROM mangas WHERE id = '$safe'");
            }
        }

        foreach ($body['mangas'] as $manga) {
            $id           = $db->real_escape_string($manga['id'] ?? '');
            $title        = $db->real_escape_string($manga['title'] ?? '');
            $type         = $db->real_escape_string($manga['type'] ?? 'manga');
            $total        = (int)($manga['total'] ?? 0);
            $read         = (int)($manga['read'] ?? 0);
            $notes        = $db->real_escape_string($manga['notes'] ?? '');
            $poster       = $db->real_escape_string($manga['poster'] ?? '');
            $lastModified = (int)($manga['lastModified'] ?? 0);

            if (isset($existingM[$manga['id']])) {
                $db->query("UPDATE mangas SET title='$title', type='$type', total=$total, `read`=$read, notes='$notes', poster='$poster', last_modified=$lastModified WHERE id='$id'");
            } else {
                $db->query("INSERT INTO mangas (id, title, type, total, `read`, notes, poster, last_modified)
                            VALUES ('$id','$title','$type',$total,$read,'$notes','$poster',$lastModified)");
            }
        }

        $db->commit();
        echo json_encode(['ok' => true]);
    } catch (Exception $e) {
        $db->rollback();
        http_response_code(500);
        echo json_encode(['error' => $e->getMessage()]);
    }

    $db->close();
}
?>