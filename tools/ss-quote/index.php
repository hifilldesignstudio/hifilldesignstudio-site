<?php
// HiFills 內部工具：S&S 報價＋庫存查詢 (v1)
// 私人工具，不對外連結。config.php 不入 git。
define('SSQ_OK', true);
session_start();
$configFile = __DIR__ . '/config.php';
$p = $_GET['p'] ?? 'search';

function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function money($n) { return '$' . number_format((float)$n, 2); }

// ---------- 首次設定 ----------
if (!file_exists($configFile)) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $p === 'setup') {
        $pw  = $_POST['pw'] ?? '';
        $pw2 = $_POST['pw2'] ?? '';
        $acc = trim($_POST['account'] ?? '');
        $key = trim($_POST['apikey'] ?? '');
        $err = '';
        if (strlen($pw) < 6) $err = '密碼至少 6 個字元';
        elseif ($pw !== $pw2) $err = '兩次密碼唔一致';
        elseif ($acc === '' || $key === '') $err = '請填寫 S&S 戶口號碼同 API key';
        if ($err === '') {
            $cfg = "<?php\n// 自動產生於 " . date('Y-m-d H:i:s') . "，請勿刪除\ndefined('SSQ_OK') or exit;\nreturn " .
                var_export(array(
                    'pw_hash' => password_hash($pw, PASSWORD_DEFAULT),
                    'account' => $acc,
                    'key'     => $key,
                ), true) . ";\n";
            file_put_contents($configFile, $cfg, LOCK_EX);
            header('Location: ?p=login');
            exit;
        }
    }
    // 顯示設定表單
    ?>
<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>首次設定 · S&S 報價工具</title>
<style><?php echo css(); ?></style></head>
<body><div class="wrap">
<h1>🛠 首次設定</h1>
<p class="muted">設定一次就好。呢個工具係私人用，請設一個登入密碼。</p>
<?php if (!empty($err)) echo '<p class="err">' . h($err) . '</p>'; ?>
<form method="post" action="?p=setup" class="card">
<label>登入密碼（至少 6 個字元）<input type="password" name="pw" required></label>
<label>再輸入一次 <input type="password" name="pw2" required></label>
<label>S&S 戶口號碼 <input name="account" placeholder="例如 430753" required></label>
<label>S&S API Key <input name="apikey" placeholder="My Account 頁面攞到嗰串" required></label>
<button type="submit">完成設定</button>
</form></div></body></html>
    <?php
    exit;
}

$config = require $configFile;
require __DIR__ . '/lib/ss_client.php';

function ss() {
    global $config;
    return new SSClient($config['account'], $config['key']);
}

// ---------- 登入 ----------
if ($p === 'login') {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (password_verify($_POST['pw'] ?? '', $config['pw_hash'])) {
            $_SESSION['ssq_auth'] = true;
            header('Location: ?p=search');
            exit;
        }
        $err = '密碼唔啱';
    }
    ?>
<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>登入 · S&S 報價工具</title>
<style><?php echo css(); ?></style></head>
<body><div class="wrap narrow">
<h1>🔒 S&S 報價工具</h1>
<p class="muted">內部工具，請登入</p>
<?php if (!empty($err)) echo '<p class="err">' . h($err) . '</p>'; ?>
<form method="post" action="?p=login" class="card">
<label>密碼 <input type="password" name="pw" required autofocus></label>
<button type="submit">登入</button>
</form></div></body></html>
    <?php
    exit;
}

if (empty($_SESSION['ssq_auth'])) { header('Location: ?p=login'); exit; }
if ($p === 'logout') { session_destroy(); header('Location: ?p=login'); exit; }

// ---------- 共用版頭 ----------
function page_head($title) {
    ?>
<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title><?php echo h($title); ?> · S&S 報價工具</title>
<style><?php echo css(); ?></style></head>
<body><div class="wrap">
<header class="topbar">
<strong>🧵 S&S 報價工具</strong>
<nav>
<a href="?p=search">查款</a>
<a href="?p=quote">報價單 <span class="badge"><?php echo quote_count(); ?></span></a>
<a href="?p=logout" class="muted">登出</a>
</nav>
</header>
<h1><?php echo h($title); ?></h1>
    <?php
}
function page_foot() { echo '</div></body></html>'; }

function css() { return <<<CSS
*{box-sizing:border-box}
body{font-family:-apple-system,"Noto Sans TC","PingFang HK","Microsoft JhengHei",sans-serif;margin:0;background:#f4f5f7;color:#222}
.wrap{max-width:960px;margin:0 auto;padding:16px}
.wrap.narrow{max-width:420px}
.topbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px}
.topbar nav a{margin-left:12px;text-decoration:none;color:#0b6bcb}
.badge{background:#0b6bcb;color:#fff;border-radius:10px;padding:1px 8px;font-size:12px}
.card{background:#fff;border-radius:10px;padding:16px;margin:12px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}
label{display:block;margin:10px 0;font-size:14px}
input[type=text],input[type=password],input[type=number]{width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;font-size:16px;margin-top:4px}
button,.btn{display:inline-block;background:#0b6bcb;color:#fff;border:0;border-radius:8px;padding:10px 18px;font-size:16px;cursor:pointer;text-decoration:none;margin-top:8px}
button.ghost,.btn.ghost{background:#e8eaed;color:#222}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;font-size:14px}
th,td{padding:8px 10px;border-bottom:1px solid #eee;text-align:left}
th{background:#f0f2f5}
.err{color:#c00;background:#fee;padding:10px;border-radius:8px}
.muted{color:#777}
.ok{color:#0a7d2c}
.stock{font-weight:bold;color:#0a7d2c}
.stock.zero{color:#c00}
.matrix td input{width:64px;padding:6px;font-size:14px}
.searchrow{display:flex;gap:8px}
.searchrow input{flex:1}
@media print{.topbar,.noprint{display:none}.wrap{max-width:100%}}
CSS;
}

// ---------- 報價單（session） ----------
function quote_get() { return $_SESSION['ssq_quote'] ?? array(); }
function quote_count() {
    $n = 0;
    foreach (quote_get() as $l) $n += (int)$l['qty'];
    return $n;
}
function quote_total() {
    $t = 0;
    foreach (quote_get() as $l) $t += $l['price'] * $l['qty'];
    return $t;
}

// ================= 查款 =================
if ($p === 'search') {
    page_head('查款');
    $q = trim($_GET['q'] ?? '');
    ?>
<form method="get" action="" class="card noprint">
<input type="hidden" name="p" value="search">
<div class="searchrow">
<input type="text" name="q" value="<?php echo h($q); ?>" placeholder="例如：Gildan 5000、BC3001、hoodie" autofocus>
<button type="submit">搜尋</button>
</div></form>
    <?php
    if ($q !== '') {
        $api = ss();
        $res = $api->searchStyles($q);
        if ($res === null) {
            echo '<p class="err">查詢失敗：' . h($api->lastError) . '</p>';
        } elseif (empty($res)) {
            echo '<p class="muted">搵唔到相關款式，試下其他關鍵字。</p>';
        } else {
            echo '<table><tr><th>品牌</th><th>款號</th><th>名稱</th><th></th></tr>';
            foreach ($res as $s) {
                echo '<tr><td>' . h($s['brandName'] ?? '') . '</td>'
                    . '<td><strong>' . h($s['styleName'] ?? '') . '</strong></td>'
                    . '<td>' . h($s['title'] ?? '') . '</td>'
                    . '<td><a class="btn" href="?p=style&id=' . (int)$s['styleID'] . '">睇價錢＋庫存</a></td></tr>';
            }
            echo '</table>';
        }
    } else {
        echo '<p class="muted">輸入品牌、款號或關鍵字搜尋 S&S 目錄（實時資料）。</p>';
    }
    page_foot();
    exit;
}

// ================= 款式詳情：價錢＋庫存 =================
if ($p === 'style') {
    $id = (int)($_GET['id'] ?? 0);
    if ($id <= 0) { header('Location: ?p=search'); exit; }

    // 加入報價單
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['act'] ?? '') === 'add') {
        $quote = quote_get();
        foreach (($_POST['qty'] ?? array()) as $sku => $qty) {
            $qty = (int)$qty;
            if ($qty <= 0) continue;
            $meta = json_decode($_POST['meta'][$sku] ?? '{}', true);
            if (empty($meta)) continue;
            if (isset($quote[$sku])) $quote[$sku]['qty'] += $qty;
            else $quote[$sku] = array(
                'sku'   => $sku,
                'style' => $meta['style'],
                'color' => $meta['color'],
                'size'  => $meta['size'],
                'price' => (float)$meta['price'],
                'qty'   => $qty,
            );
        }
        $_SESSION['ssq_quote'] = $quote;
        header('Location: ?p=quote');
        exit;
    }

    $api = ss();
    $inv = $api->inventoryByStyleId($id, 'ON');
    // 用 products/?styleid 攞價錢
    $prods = $api->productsByStyleId($id);

    if ($inv === null || $prods === null) {
        page_head('款式詳情');
        echo '<p class="err">查詢失敗：' . h($api->lastError) . '</p>';
        page_foot();
        exit;
    }

    // 合併：sku => [qty_on, color, size, price, style]
    $items = array();
    foreach ($inv as $row) {
        $sku = $row['sku'];
        $qtyOn = 0;
        foreach ($row['warehouses'] as $w) {
            if ($w['warehouseAbbr'] === 'ON') $qtyOn = (int)$w['qty'];
        }
        $items[$sku] = array('sku' => $sku, 'qty_on' => $qtyOn);
    }
    $styleLabel = '';
    foreach ($prods as $pr) {
        $sku = $pr['sku'] ?? '';
        if ($sku === '') continue;
        $price = $pr['customerPrice'] ?? $pr['salePrice'] ?? $pr['piecePrice'] ?? 0;
        if (!isset($items[$sku])) $items[$sku] = array('sku' => $sku, 'qty_on' => 0);
        $items[$sku]['color'] = $pr['colorName'] ?? '';
        $items[$sku]['size']  = $pr['sizeName'] ?? '';
        $items[$sku]['price'] = (float)$price;
        if ($styleLabel === '') $styleLabel = $pr['styleName'] ?? '';
    }

    // 按顏色分組
    $byColor = array();
    foreach ($items as $it) {
        $c = $it['color'] ?? '—';
        $byColor[$c][] = $it;
    }
    ksort($byColor);

    page_head(($styleLabel ? $styleLabel . ' ' : '') . '價錢＋庫存');
    echo '<p class="muted noprint">💰 價錢係你嘅入貨價（CAD） · 📦 庫存係 Vaughan 倉（ON）實時數量</p>';
    echo '<form method="post" action="?p=style&id=' . $id . '">'
        . '<input type="hidden" name="act" value="add">';
    foreach ($byColor as $color => $list) {
        // 收集所有尺碼作欄
        $sizes = array();
        foreach ($list as $it) { $sizes[$it['size'] ?? '—'] = true; }
        echo '<div class="card"><h3 style="margin-top:0">' . h($color) . '</h3>';
        echo '<table class="matrix"><tr><th>尺碼</th><th>入貨價</th><th>ON 倉存貨</th><th>數量</th></tr>';
        foreach ($list as $it) {
            $sku = $it['sku'];
            $meta = array('style' => $styleLabel, 'color' => $it['color'] ?? '',
                          'size' => $it['size'] ?? '', 'price' => $it['price'] ?? 0);
            $zc = ($it['qty_on'] > 0) ? 'stock' : 'stock zero';
            echo '<tr><td>' . h($it['size'] ?? '—') . '</td>'
                . '<td>' . money($it['price'] ?? 0) . '</td>'
                . '<td class="' . $zc . '">' . number_format($it['qty_on']) . '</td>'
                . '<td><input type="number" name="qty[' . h($sku) . ']" min="0" value="0">'
                . '<input type="hidden" name="meta[' . h($sku) . ']" value=\'' . h(json_encode($meta)) . '\'></td></tr>';
        }
        echo '</table></div>';
    }
    echo '<button type="submit" class="noprint">➕ 加入報價單</button> '
        . '<a class="btn ghost noprint" href="?p=search">← 返回搜尋</a></form>';
    page_foot();
    exit;
}

// ================= 報價單 =================
if ($p === 'quote') {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $act = $_POST['act'] ?? '';
        if ($act === 'remove') {
            $quote = quote_get();
            unset($quote[$_POST['sku'] ?? '']);
            $_SESSION['ssq_quote'] = $quote;
        } elseif ($act === 'clear') {
            $_SESSION['ssq_quote'] = array();
        } elseif ($act === 'saveinfo') {
            $_SESSION['ssq_client'] = trim($_POST['client'] ?? '');
            $_SESSION['ssq_po'] = trim($_POST['po'] ?? '');
        }
        header('Location: ?p=quote');
        exit;
    }
    page_head('報價單');
    $quote = quote_get();
    if (empty($quote)) {
        echo '<p class="muted">報價單係空嘅。去 <a href="?p=search">查款</a> 揀款加入。</p>';
        page_foot();
        exit;
    }
    $client = $_SESSION['ssq_client'] ?? '';
    $po = $_SESSION['ssq_po'] ?? '';
    ?>
<div class="card noprint"><form method="post" action="?p=quote">
<input type="hidden" name="act" value="saveinfo">
<label>客戶名稱 <input type="text" name="client" value="<?php echo h($client); ?>"></label>
<label>PO / 備註 <input type="text" name="po" value="<?php echo h($po); ?>"></label>
<button type="submit">儲存</button></form></div>
<table>
<tr><th>款式</th><th>顏色</th><th>尺碼</th><th>單價</th><th>數量</th><th>小計</th><th class="noprint"></th></tr>
    <?php foreach ($quote as $sku => $l): ?>
<tr>
<td><?php echo h($l['style']); ?><br><span class="muted"><?php echo h($sku); ?></span></td>
<td><?php echo h($l['color']); ?></td>
<td><?php echo h($l['size']); ?></td>
<td><?php echo money($l['price']); ?></td>
<td><?php echo (int)$l['qty']; ?></td>
<td><strong><?php echo money($l['price'] * $l['qty']); ?></strong></td>
<td class="noprint"><form method="post" action="?p=quote" style="display:inline">
<input type="hidden" name="act" value="remove">
<input type="hidden" name="sku" value="<?php echo h($sku); ?>">
<button type="submit" class="ghost">刪除</button></form></td>
</tr>
    <?php endforeach; ?>
<tr><td colspan="5" style="text-align:right"><strong>總計</strong></td>
<td colspan="2"><strong><?php echo money(quote_total()); ?></strong></td></tr>
</table>
<p class="muted noprint">以上係你嘅入貨成本（未計印製、運費、稅）。</p>
<div class="noprint">
<a class="btn" href="?p=print" target="_blank">🖨 列印／出 PDF</a>
<a class="btn" href="?p=order">📦 經 S&S 落單</a>
<form method="post" action="?p=quote" style="display:inline">
<input type="hidden" name="act" value="clear">
<button type="submit" class="ghost" onclick="return confirm('清空成張報價單？')">清空</button></form>
</div>
    <?php
    page_foot();
    exit;
}

// ================= 列印版 =================
if ($p === 'print') {
    $quote = quote_get();
    $client = $_SESSION['ssq_client'] ?? '';
    $po = $_SESSION['ssq_po'] ?? '';
    ?>
<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8">
<title>報價單 · HiFills Studio</title>
<style>
body{font-family:-apple-system,"Noto Sans TC","PingFang HK","Microsoft JhengHei",sans-serif;color:#222;max-width:800px;margin:0 auto;padding:24px}
h1{margin-bottom:0} .meta{color:#555;margin:8px 0 20px}
table{width:100%;border-collapse:collapse} th,td{padding:8px;border-bottom:1px solid #ccc;text-align:left}
th{background:#f0f0f0} .total td{font-size:18px;font-weight:bold;border-top:2px solid #222}
.foot{margin-top:32px;color:#555;font-size:13px}
@media print{.noprint{display:none}}
</style></head><body>
<h1>HiFills Studio — 報價單</h1>
<div class="meta">日期：<?php echo date('Y-m-d'); ?>
<?php if ($client) echo '　客戶：' . h($client); ?>
<?php if ($po) echo '　備註：' . h($po); ?></div>
<table>
<tr><th>款式</th><th>顏色</th><th>尺碼</th><th>單價</th><th>數量</th><th>小計</th></tr>
<?php foreach ($quote as $l): ?>
<tr><td><?php echo h($l['style']); ?></td><td><?php echo h($l['color']); ?></td>
<td><?php echo h($l['size']); ?></td><td><?php echo money($l['price']); ?></td>
<td><?php echo (int)$l['qty']; ?></td><td><?php echo money($l['price'] * $l['qty']); ?></td></tr>
<?php endforeach; ?>
<tr class="total"><td colspan="5">總計</td><td><?php echo money(quote_total()); ?></td></tr>
</table>
<div class="foot">此為入貨成本報價，未含印製費用、運費及稅項。有效期 7 日。<br>HiFills Studio · 416-800-2920</div>
<p class="noprint"><button onclick="window.print()">列印</button></p>
</body></html>
    <?php
    exit;
}

// ================= 經 S&S 落單 (v2) =================
if ($p === 'order') {
    $quote = quote_get();
    if (empty($quote)) { header('Location: ?p=quote'); exit; }
    $api = ss();

    // --- 步驟3：真實落單 ---
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['step'] ?? '') === 'place') {
        $draft = $_SESSION['ssq_order_draft'] ?? null;
        if (!$draft) { header('Location: ?p=order'); exit; }
        $lines = array();
        foreach ($quote as $sku => $l) {
            $lines[] = array('identifier' => $sku, 'qty' => (int)$l['qty'], 'warehouseAbbr' => 'ON');
        }
        $res = $api->placeOrder($lines, array(
            'shippingAddress'   => $draft['address'],
            'shippingMethod'    => $draft['method'],
            'poNumber'          => $draft['po'],
            'emailConfirmation' => $draft['email'],
            'paymentProfile'    => array('email' => $draft['pay_email'], 'profileID' => (int)$draft['profile_id']),
            'testOrder'         => false,
        ));
        page_head('落單結果');
        if ($res === null) {
            echo '<p class="err">落單失敗：' . h($api->lastError) . '</p>';
            echo '<p class="muted">如果見到 EXPIRED_CARD，即係 S&S 戶口嗰張卡過期咗，要去 S&S 網站 My Account 更新有效嘅卡。</p>';
            echo '<a class="btn ghost" href="?p=order">← 返回修改</a>';
        } else {
            $o = (is_array($res) && isset($res[0])) ? $res[0] : $res;
            echo '<div class="card"><h3 class="ok">✅ 落單成功</h3>';
            echo '<p>訂單號碼：<strong>' . h($o['orderNumber'] ?? '') . '</strong><br>'
                . '狀態：' . h($o['orderStatus'] ?? '') . '<br>'
                . '總數：' . money($o['total'] ?? 0) . '（' . (int)($o['totalPieces'] ?? 0) . ' 件）<br>'
                . '取貨方式：' . h($draft['method'] === SSClient::SHIP_PICKUP ? 'Vaughan 倉自取' : 'S&S 送貨') . '</p></div>';
            $_SESSION['ssq_quote'] = array();
            unset($_SESSION['ssq_order_draft']);
            echo '<a class="btn" href="?p=search">繼續查款</a> ';
            echo '<a class="btn ghost" href="?p=quote">報價單</a>';
        }
        page_foot();
        exit;
    }

    // --- 步驟2：確認頁 ---
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && ($_POST['step'] ?? '') === 'review') {
        $draft = array(
            'method'     => $_POST['method'] ?? SSClient::SHIP_PICKUP,
            'po'         => trim($_POST['po'] ?? ''),
            'email'      => trim($_POST['email'] ?? ''),
            'pay_email'  => trim($_POST['pay_email'] ?? ''),
            'profile_id' => $_POST['profile_id'] ?? '',
            'address'    => array(
                'customer'    => trim($_POST['a_customer'] ?? ''),
                'attn'        => trim($_POST['a_attn'] ?? ''),
                'address'     => trim($_POST['a_address'] ?? ''),
                'city'        => trim($_POST['a_city'] ?? ''),
                'state'       => trim($_POST['a_state'] ?? ''),
                'zip'         => trim($_POST['a_zip'] ?? ''),
                'residential' => false,
            ),
        );
        if ($draft['profile_id'] === '') {
            page_head('經 S&S 落單');
            echo '<p class="err">請選擇付款方式。</p><a class="btn ghost" href="?p=order">← 返回</a>';
            page_foot();
            exit;
        }
        $_SESSION['ssq_order_draft'] = $draft;
        page_head('確認落單');
        echo '<div class="card"><p class="err"><strong>⚠️ 呢個係真實落單，一按確認就會即時收費。</strong></p>';
        echo '<table><tr><th>款式</th><th>顏色</th><th>尺碼</th><th>單價</th><th>數量</th><th>小計</th></tr>';
        foreach ($quote as $l) {
            echo '<tr><td>' . h($l['style']) . '</td><td>' . h($l['color']) . '</td><td>' . h($l['size']) . '</td>'
                . '<td>' . money($l['price']) . '</td><td>' . (int)$l['qty'] . '</td>'
                . '<td>' . money($l['price'] * $l['qty']) . '</td></tr>';
        }
        echo '<tr><td colspan="5" style="text-align:right"><strong>總計</strong></td><td><strong>' . money(quote_total()) . '</strong></td></tr></table>';
        echo '<p>取貨方式：<strong>' . h($draft['method'] === SSClient::SHIP_PICKUP ? 'Vaughan 倉自取 (Will Call)' : 'S&S 送貨（最平 ground）') . '</strong><br>'
            . 'PO：' . h($draft['po']) . '<br>確認電郵：' . h($draft['email']) . '<br>付款方式 ID：' . h($draft['profile_id']) . '</p>';
        echo '<form method="post" action="?p=order"><input type="hidden" name="step" value="place">'
            . '<button type="submit" onclick="return confirm(\'真係要落單？會即時收費。\')">✅ 確認落單</button> '
            . '<a class="btn ghost" href="?p=order">← 返回修改</a></form></div>';
        page_foot();
        exit;
    }

    // --- 步驟1：落單表單 ---
    $payEmail = trim($_GET['pay_email'] ?? 'info@hifillstudio.com');
    $profiles = $api->paymentProfiles($payEmail);
    page_head('經 S&S 落單');
    ?>
<div class="card">
<p class="muted">以下會經 S&S API 直接落真單。建議先去報價單確認內容。</p>
<form method="get" action="" class="card noprint" style="margin-top:0">
<input type="hidden" name="p" value="order">
<label style="margin-top:0"><strong>S&S 網站登入電郵</strong>（用嚟載入已儲存嘅付款方式）
<div class="searchrow">
<input type="text" name="pay_email" value="<?php echo h($payEmail); ?>">
<button type="submit" class="ghost">載入</button>
</div></label></form>
<form method="post" action="?p=order">
<input type="hidden" name="step" value="review">
<label><strong>取貨方式</strong></label>
<label><input type="radio" name="method" value="<?php echo SSClient::SHIP_PICKUP; ?>" checked style="width:auto">
Vaughan 倉自取 (Will Call) — 預設</label>
<label><input type="radio" name="method" value="<?php echo SSClient::SHIP_CHEAPEST; ?>" style="width:auto">
S&S 送貨（系統揀最平嘅 ground）</label>
<label>PO / 備註 <input type="text" name="po" value="<?php echo h($_SESSION['ssq_po'] ?? ''); ?>"></label>
<label>訂單確認電郵 <input type="text" name="email" value="info@hifillstudio.com"></label>
<label><strong>付款方式</strong>（S&S 網站已儲存嘅卡）</label>
<input type="hidden" name="pay_email" value="<?php echo h($payEmail); ?>">
    <?php
    if ($profiles === null) {
        echo '<p class="err">讀取付款方式失敗：' . h($api->lastError) . '</p>';
    } elseif (empty($profiles)) {
        echo '<p class="err">呢個電郵冇已儲存嘅付款方式，請先去 S&S 網站 My Account 加卡。</p>';
    } else {
        foreach ($profiles as $pf) {
            echo '<label><input type="radio" name="profile_id" value="' . (int)$pf['profileID'] . '" style="width:auto"> '
                . h($pf['name'] ?? ('Profile ' . $pf['profileID'])) . '</label>';
        }
    }
    ?>
<label><strong>地址</strong>（系統要求填寫；自取唔會用嚟送貨）</label>
<label>公司 <input type="text" name="a_customer" value="HiFills Studio"></label>
<label>聯絡人 <input type="text" name="a_attn" value="Illo Lam"></label>
<label>地址 <input type="text" name="a_address" value="6675 Langstaff Rd"></label>
<label>城市 <input type="text" name="a_city" value="Woodbridge"></label>
<label>省份 <input type="text" name="a_state" value="ON"></label>
<label>郵編 <input type="text" name="a_zip" value="L4H4W9"></label>
<button type="submit">下一步：確認內容 →</button>
<a class="btn ghost" href="?p=quote">← 返回報價單</a>
</form></div>
    <?php
    page_foot();
    exit;
}

// 預設
header('Location: ?p=search');
