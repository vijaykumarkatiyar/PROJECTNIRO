<?php
declare(strict_types=1);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$payload = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($payload)) {
    $payload = [];
}

$speechText = trim((string)($payload['text'] ?? ''));
if ($speechText === '') {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Text is required']);
    exit;
}

$requestApiKey = trim((string)($payload['apiKey'] ?? ''));
$envApiKey = getenv('OPENAI_API_KEY') ?: getenv('VITE_OPENAI_API_KEY') ?: '';
$apiKey = preg_match('/^sk-[A-Za-z0-9_-]+/', $requestApiKey) ? $requestApiKey : $envApiKey;

if (!$apiKey) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'OpenAI API key is missing']);
    exit;
}

$speechModel = getenv('OPENAI_TTS_MODEL') ?: getenv('VITE_OPENAI_TTS_MODEL') ?: 'gpt-4o-mini-tts';
$femaleSpeechVoice = getenv('OPENAI_TTS_FEMALE_VOICE') ?: getenv('VITE_OPENAI_TTS_FEMALE_VOICE') ?: (getenv('OPENAI_TTS_VOICE') ?: 'coral');
$maleSpeechVoice = getenv('OPENAI_TTS_MALE_VOICE') ?: getenv('VITE_OPENAI_TTS_MALE_VOICE') ?: 'onyx';
$femaleMimicVoice = getenv('OPENAI_MIMIC_TTS_FEMALE_VOICE') ?: getenv('VITE_OPENAI_MIMIC_TTS_FEMALE_VOICE') ?: (getenv('OPENAI_MIMIC_TTS_VOICE') ?: 'shimmer');
$maleMimicVoice = getenv('OPENAI_MIMIC_TTS_MALE_VOICE') ?: getenv('VITE_OPENAI_MIMIC_TTS_MALE_VOICE') ?: $maleSpeechVoice;

$speechStyle = strtolower(trim((string)($payload['style'] ?? 'teacher')));
$targetDurationMs = (float)($payload['targetDurationMs'] ?? 0);
$requestLanguage = strtolower(trim((string)($payload['language'] ?? 'hi'))) === 'en' ? 'en' : 'hi';
$requestAvatarMode = strtolower(trim((string)($payload['avatarMode'] ?? 'female'))) === 'male' ? 'male' : 'female';
$isMimicSpeech = $speechStyle === 'mimic';
$isReadSpeech = $speechStyle === 'read';

$targetSeconds = $targetDurationMs > 0 ? max(0.7, min(12, $targetDurationMs / 1000)) : 0;
$estimatedSeconds = max(0.8, strlen($speechText) * 0.085);
$mimicSpeed = $targetSeconds > 0 ? max(0.65, min(1.8, $estimatedSeconds / $targetSeconds)) : 1.12;

$selectedVoice = $requestAvatarMode === 'male'
    ? ($isMimicSpeech ? $maleMimicVoice : $maleSpeechVoice)
    : ($isMimicSpeech ? $femaleMimicVoice : $femaleSpeechVoice);

if ($isMimicSpeech) {
    $instructions = implode(' ', [
        'Repeat the input text exactly with no extra words.',
        $requestAvatarMode === 'male'
            ? 'Use a clearly male, bright, playful cartoon voice, like a fun talking-toy repeat.'
            : 'Use a bright, playful childlike cartoon voice, like a fun talking-toy repeat.',
        'Keep it clear and friendly.',
        $requestLanguage === 'en' ? 'Use natural English pronunciation.' : 'Use natural Hindi or Hinglish pronunciation when needed.',
        $targetSeconds > 0 ? 'Match the user speaking pace; aim for about ' . number_format($targetSeconds, 1) . ' seconds total.' : 'Use a quick playful pace.',
    ]);
} elseif ($isReadSpeech) {
    $instructions = $requestLanguage === 'en'
        ? 'Read the input text exactly in clear English. Use a warm expressive ' . $requestAvatarMode . ' voice, pause naturally, and keep every word easy to understand.'
        : 'Read the input text exactly in clear Hindi or Hinglish. Use a warm expressive ' . $requestAvatarMode . ' voice, pause naturally, and keep every word easy to understand.';
} else {
    $instructions = $requestLanguage === 'en'
        ? 'Speak in clear, natural English with a warm ' . $requestAvatarMode . ' teacher-like voice.'
        : 'Speak in clear, natural Hindi with a warm ' . $requestAvatarMode . ' teacher-like voice.';
}

$body = json_encode([
    'model' => $speechModel,
    'voice' => $selectedVoice,
    'input' => function_exists('mb_substr') ? mb_substr($speechText, 0, 4000, 'UTF-8') : substr($speechText, 0, 4000),
    'instructions' => $instructions,
    'response_format' => 'mp3',
    'speed' => $isMimicSpeech ? $mimicSpeed : ($isReadSpeech ? 0.94 : 1),
]);

$ch = curl_init('https://api.openai.com/v1/audio/speech');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => $body,
    CURLOPT_TIMEOUT => 35,
]);

$audio = curl_exec($ch);
$status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($audio === false || $status < 200 || $status >= 300) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => $error ?: 'OpenAI speech request failed']);
    exit;
}

header('Content-Type: audio/mpeg');
header('Cache-Control: no-store');
echo $audio;
