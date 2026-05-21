<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

function send_json(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function collect_text($value): string
{
    if (is_string($value)) {
        return $value;
    }

    if (!is_array($value)) {
        return '';
    }

    $parts = [];
    foreach ($value as $key => $item) {
        if ($key === 'text' && is_string($item)) {
            $parts[] = $item;
            continue;
        }

        $text = collect_text($item);
        if ($text !== '') {
            $parts[] = $text;
        }
    }

    return trim(implode("\n", array_unique($parts)));
}

$rawBody = file_get_contents('php://input');
$payload = json_decode($rawBody ?: '{}', true);
if (!is_array($payload)) {
    send_json(400, ['error' => 'Invalid JSON body']);
}

$message = trim((string)($payload['message'] ?? ''));
if ($message === '') {
    send_json(400, ['error' => 'Message is required']);
}

$language = strtolower(trim((string)($payload['language'] ?? 'hi'))) === 'en' ? 'en' : 'hi';
$avatarMode = strtolower(trim((string)($payload['avatarMode'] ?? 'female'))) === 'male' ? 'male' : 'female';
$apiKey = trim((string)($payload['apiKey'] ?? ''));
if ($apiKey === '') {
    $apiKey = trim((string)(getenv('OPENAI_API_KEY') ?: ''));
}

if (!preg_match('/^sk-[A-Za-z0-9_-]+$/', $apiKey)) {
    send_json(400, ['error' => 'A valid OpenAI API key is required']);
}

$history = $payload['history'] ?? [];
if (!is_array($history)) {
    $history = [];
}
$history = array_slice($history, -12);

$lines = [];
foreach ($history as $item) {
    if (!is_array($item)) {
        continue;
    }
    $speaker = ($item['role'] ?? '') === 'user' ? 'Student' : 'Teacher';
    $text = trim((string)($item['text'] ?? ''));
    if ($text !== '') {
        $lines[] = $speaker . ': ' . $text;
    }
}
$lines[] = 'Student: ' . $message;
$lines[] = 'Teacher:';
$transcript = implode("\n", $lines);

if ($language === 'en') {
    $instructions = $avatarMode === 'male'
        ? 'You are speaking as the currently selected male AI teacher companion. The selected language mode is English and it always wins over the language/script used by the student. If the student writes in Hindi, Devanagari, Hinglish, or any other language, still answer only in natural English. Keep your persona, examples, and self-references consistent with a male teacher avatar and male voice. Keep answers warm, educational, and concise in 1-3 sentences unless the user asks for detail.'
        : 'You are speaking as the currently selected female AI teacher companion. The selected language mode is English and it always wins over the language/script used by the student. If the student writes in Hindi, Devanagari, Hinglish, or any other language, still answer only in natural English. Keep your persona, examples, and self-references consistent with a female teacher avatar and female voice. Keep answers warm, educational, and concise in 1-3 sentences unless the user asks for detail.';
} else {
    $instructions = $avatarMode === 'male'
        ? 'You are speaking as the currently selected male AI teacher companion. The selected language mode is Hindi and it always wins over the language/script used by the student. If the student writes in English, Latin script, Hinglish, or any other language, still answer only in natural Hindi using Devanagari script. Use masculine self-reference and grammar, such as "मैं आपका AI शिक्षक हूँ" and "मैं समझा रहा हूँ". Keep answers warm, educational, and concise in 1-3 sentences unless the user asks for detail.'
        : 'You are speaking as the currently selected female AI teacher companion. The selected language mode is Hindi and it always wins over the language/script used by the student. If the student writes in English, Latin script, Hinglish, or any other language, still answer only in natural Hindi using Devanagari script. Use feminine self-reference and grammar, such as "मैं आपकी AI शिक्षिका हूँ" and "मैं समझा रही हूँ". Keep answers warm, educational, and concise in 1-3 sentences unless the user asks for detail.';
}

$model = trim((string)(getenv('OPENAI_MODEL') ?: 'gpt-4o-mini'));
$requestBody = json_encode([
    'model' => $model,
    'instructions' => $instructions,
    'input' => $transcript,
], JSON_UNESCAPED_UNICODE);

if (!function_exists('curl_init')) {
    send_json(500, ['error' => 'PHP cURL is not enabled on this hosting account']);
}

$ch = curl_init('https://api.openai.com/v1/responses');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => $requestBody,
    CURLOPT_TIMEOUT => 30,
]);

$responseBody = curl_exec($ch);
$curlError = curl_error($ch);
$statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($responseBody === false) {
    send_json(500, ['error' => $curlError ?: 'OpenAI request failed']);
}

$responseData = json_decode((string)$responseBody, true);
if (!is_array($responseData)) {
    send_json(500, ['error' => 'OpenAI returned an invalid response']);
}

if ($statusCode < 200 || $statusCode >= 300) {
    $error = $responseData['error']['message'] ?? 'OpenAI request failed';
    send_json($statusCode ?: 500, ['error' => $error]);
}

$text = trim((string)($responseData['output_text'] ?? ''));
if ($text === '') {
    $text = collect_text($responseData['output'] ?? []);
}

send_json(200, [
    'text' => $text !== ''
        ? $text
        : ($language === 'en' ? 'Sorry, I did not get a response yet.' : 'माफ़ कीजिए, मुझे अभी जवाब नहीं मिला।'),
]);
