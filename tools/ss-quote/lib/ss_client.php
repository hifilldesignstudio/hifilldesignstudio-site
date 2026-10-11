<?php
/**
 * S&S Activewear Canada REST API connector (v2)
 * Docs: https://api-ca.ssactivewear.com
 * Auth: HTTP Basic — username = S&S account number, password = API key
 * Rate limit: 60 req/min
 *
 * The API key is NEVER hardcoded here — pass it in from config.php
 * (which lives on the server only and is NOT committed to git).
 */
class SSClient {
    const BASE = 'https://api-ca.ssactivewear.com/v2/';

    // shippingMethod codes (POST /orders)
    const SHIP_GROUND        = '1';   // Ground (carrier chosen by S&S)
    const SHIP_PICKUP        = '6';   // Will Call / PickUp  <-- Illo's default (Vaughan)
    const SHIP_MESSENGER    = '8';   // Messenger Pickup
    const SHIP_CHEAPEST      = '54';  // S&S picks cheapest ground (Purolator/UPS)
    const SHIP_UPS_GROUND    = '40';
    const SHIP_PUROLATOR_GND = '81';

    // CA warehouse abbreviations (from live inventory data)
    const WH_ON = 'ON';  // Vaughan, ON — Illo's pickup warehouse
    const WH_BC = 'BC';
    const WH_AB = 'AB';

    private $account;
    private $apiKey;
    public $lastError = null;
    public $lastHttpCode = null;

    public function __construct($account, $apiKey) {
        $this->account = $account;
        $this->apiKey  = $apiKey;
    }

    private function request($method, $path, $data = null) {
        $this->lastError = null;
        $url = self::BASE . ltrim($path, '/');
        $ch = curl_init($url);
        $headers = array(
            'Authorization: Basic ' . base64_encode($this->account . ':' . $this->apiKey),
            'User-Agent: HiFills-SS-Tool/1.0',
        );
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_HTTPHEADER,
            $method === 'POST'
                ? array_merge($headers, array('Content-Type: application/json'))
                : $headers);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        if ($data !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        $body = curl_exec($ch);
        $this->lastHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $decoded = json_decode($body, true);
        if ($this->lastHttpCode >= 400) {
            $this->lastError = $this->parseError($decoded, $body);
            return null;
        }
        return $decoded;
    }

    private function parseError($decoded, $raw) {
        if (is_array($decoded) && isset($decoded['errors'])) {
            $msgs = array();
            foreach ($decoded['errors'] as $e) {
                $msgs[] = '[' . ($e['field'] ?? '?') . '] ' . ($e['message'] ?? '');
            }
            return implode(' ', $msgs);
        }
        return 'HTTP ' . $this->lastHttpCode . ': ' . substr($raw, 0, 300);
    }

    /** Search styles, e.g. "Gildan 5000". Returns list of style objects. */
    public function searchStyles($query) {
        return $this->request('GET', 'styles/?search=' . urlencode($query) . '&mediatype=json');
    }

    /** Inventory for a styleID, with per-warehouse qty. */
    public function inventoryByStyleId($styleId, $warehouses = '') {
        $q = 'inventory/?styleid=' . urlencode($styleId) . '&mediatype=json';
        if ($warehouses !== '') $q .= '&Warehouses=' . urlencode($warehouses);
        return $this->request('GET', $q);
    }

    /** Inventory for specific SKUs (comma-separated). */
    public function inventoryBySkus($skus, $warehouses = '') {
        $q = 'inventory/' . urlencode($skus) . '?mediatype=json';
        if ($warehouses !== '') $q .= '&Warehouses=' . urlencode($warehouses);
        return $this->request('GET', $q);
    }

    /**
     * Product details incl. HER price (customerPrice).
     * $fields e.g. 'Sku,StyleName,ColorName,SizeName,CustomerPrice,SalePrice'
     */
    public function product($sku, $fields = 'Sku,StyleName,Title,ColorName,SizeName,CustomerPrice,SalePrice,PiecePrice') {
        return $this->request('GET', 'products/' . urlencode($sku)
            . '?fields=' . urlencode($fields) . '&mediatype=json');
    }

    /** All products of a style (for the price matrix), with selected fields. */
    public function productsByStyleId($styleId, $fields = 'Sku,StyleName,ColorName,SizeName,CustomerPrice,SalePrice,PiecePrice') {
        return $this->request('GET', 'products/?styleid=' . urlencode($styleId)
            . '&fields=' . urlencode($fields) . '&mediatype=json');
    }

    /** Saved payment profiles (cards/bank) for the website login email. */
    public function paymentProfiles($email) {
        return $this->request('GET', 'paymentprofiles/?email=' . urlencode($email) . '&mediatype=json');
    }

    /**
     * Place an order.
     * $lines: array of ['identifier' => sku, 'qty' => n, 'warehouseAbbr' => 'ON']
     * $opts: shippingMethod (default pickup), poNumber, emailConfirmation,
     *        paymentProfile ['email'=>..,'profileID'=>..], testOrder (bool)
     */
    public function placeOrder($lines, $opts = array()) {
        $payload = array(
            'shippingAddress'  => $opts['shippingAddress'],   // required even for pickup
            'shippingMethod'   => $opts['shippingMethod'] ?? self::SHIP_PICKUP,
            'poNumber'         => $opts['poNumber'] ?? '',
            'emailConfirmation'=> $opts['emailConfirmation'] ?? '',
            'testOrder'        => $opts['testOrder'] ?? false,
            'lines'            => array(),
        );
        foreach ($lines as $l) {
            $payload['lines'][] = array(
                'identifier'    => $l['identifier'],
                'qty'           => (int)$l['qty'],
                'warehouseAbbr' => $l['warehouseAbbr'] ?? self::WH_ON,
            );
        }
        if (!empty($opts['paymentProfile'])) {
            $payload['paymentProfile'] = $opts['paymentProfile'];
        }
        return $this->request('POST', 'orders/', $payload);
    }

    /** Recent orders (status/tracking). */
    public function orders($params = '') {
        return $this->request('GET', 'orders/' . $params);
    }
}
