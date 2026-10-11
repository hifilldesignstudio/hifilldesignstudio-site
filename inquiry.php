<?php
// HiFills Design Studio — project inquiry form handler
header('Content-Type: application/json');

$to = 'info@hifilldesignstudio.com';

function field($k) {
    $v = isset($_POST[$k]) ? trim((string)$_POST[$k]) : '';
    return str_replace(array("\r", "\n"), ' ', $v); // block header injection
}

$name  = field('name');
$email = field('email');

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(array('ok' => false, 'error' => 'invalid'));
    exit;
}

// Free-text "about" field: keep line breaks for the message body (never used in headers).
$about = isset($_POST['about']) ? trim((string)$_POST['about']) : '';

$lines = array(
    'Name: ' . $name,
    'Business: ' . (field('business') !== '' ? field('business') : 'Not provided'),
    'Email: ' . $email,
    'Phone: ' . (field('phone') !== '' ? field('phone') : 'Not provided'),
    'Website type: ' . (field('website_type') !== '' ? field('website_type') : 'Not provided'),
    '',
    'About the business:',
    $about !== '' ? $about : 'None provided'
);

$subject = 'Website project inquiry from ' . $name;
$headers = "From: noreply@hifilldesignstudio.com\r\n"
         . "Reply-To: " . $email . "\r\n"
         . "Content-Type: text/plain; charset=UTF-8";

$sent = mail($to, $subject, implode("\n", $lines), $headers);
echo json_encode(array('ok' => (bool)$sent));
