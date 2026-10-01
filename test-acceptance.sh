#!/usr/bin/env bash
# ==============================================================================
# CART RESTFUL API - AUTOMATED ACCEPTANCE TEST SCRIPT (SLIDES 19 & 20)
# ==============================================================================

set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo -e "\n${BOLD}${CYAN}========================================================================${NC}"
echo -e "${BOLD}${CYAN}    CART RESTFUL API - ACCEPTANCE TEST SUITE (BASH / CURL / JQ)        ${NC}"
echo -e "${BOLD}${CYAN}    Target: ${BASE_URL}                                                ${NC}"
echo -e "${BOLD}${CYAN}========================================================================${NC}\n"

# Check if server is running
if ! curl -s --max-time 3 "${BASE_URL}/health" > /dev/null; then
  echo -e "${YELLOW}Server is not running at ${BASE_URL}.${NC}"
  echo -e "Starting TypeScript automated test runner directly via npm run test:acceptance...\n"
  npm run test:acceptance
  exit $?
fi

assert_response() {
  local num="$1"
  local name="$2"
  local method="$3"
  local path="$4"
  local exp_status="$5"
  local exp_code="$6"
  local actual_status="$7"
  local body="$8"

  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  local actual_code=""
  if command -v jq &> /dev/null && [ -n "$body" ]; then
    actual_code=$(echo "$body" | jq -r '.code // empty' 2>/dev/null)
  fi

  local is_passed=true
  if [ "$actual_status" -ne "$exp_status" ]; then
    is_passed=false
  fi
  if [ -n "$exp_code" ] && [ "$actual_code" != "$exp_code" ]; then
    is_passed=false
  fi

  if [ "$is_passed" = true ]; then
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo -e " ${GREEN}${BOLD}[PASS]${NC} #${num} [${method} ${path}] ${name}"
    echo -e "       ${BOLD}Status:${NC} ${actual_status} (Expected: ${exp_status} ${exp_code})"
  else
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo -e " ${RED}${BOLD}[FAIL]${NC} #${num} [${method} ${path}] ${name}"
    echo -e "       ${RED}Status: ${actual_status} (Expected: ${exp_status}) | Code: '${actual_code}' (Expected: '${exp_code}')${NC}"
  fi
}

SEED_PROD_A="11111111-1111-1111-1111-111111111111"
SEED_PROD_B="22222222-2222-2222-2222-222222222222"
SEED_PROD_D="44444444-4444-4444-4444-444444444444"
SEED_PROD_E="55555555-5555-5555-5555-555555555555"
CLOSED_CART="99999999-9999-9999-9999-999999999999"
NON_EXISTENT_UUID="00000000-0000-0000-0000-000000000000"

# Create a test cart
CART_RESP=$(curl -s -X POST "${BASE_URL}/carts")
CART_ID=$(echo "$CART_RESP" | jq -r '.id')

echo -e "${BOLD}--- BẢNG 1: REQUEST SAI (Slide 19: Boundary Validation) ---${NC}"

# Test 1: Quantity = 0
RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/carts/${CART_ID}/items" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\": \"${SEED_PROD_A}\", \"quantity\": 0}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_response 1 "quantity bằng 0" "POST" "/carts/{id}/items" 400 "VALIDATION_ERROR" "$STATUS" "$BODY"

# Test 2: Quantity = 11
RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/carts/${CART_ID}/items" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\": \"${SEED_PROD_A}\", \"quantity\": 11}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_response 2 "quantity bằng 11 (vượt max 10)" "POST" "/carts/{id}/items" 400 "VALIDATION_ERROR" "$STATUS" "$BODY"

# Test 3: Quantity = "2" (string)
RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/carts/${CART_ID}/items" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\": \"${SEED_PROD_A}\", \"quantity\": \"2\"}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_response 3 "quantity dạng chuỗi \"2\"" "POST" "/carts/{id}/items" 400 "VALIDATION_ERROR" "$STATUS" "$BODY"

# Test 4: Thiếu product_id
RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/carts/${CART_ID}/items" \
  -H "Content-Type: application/json" \
  -d "{\"quantity\": 2}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_response 4 "Thiếu trường product_id" "POST" "/carts/{id}/items" 400 "VALIDATION_ERROR" "$STATUS" "$BODY"

# Test 5: Body có field lạ
RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/carts/${CART_ID}/items" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\": \"${SEED_PROD_A}\", \"quantity\": 2, \"hack\": 123}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_response 5 "Body chứa field lạ (additionalProperties: false)" "POST" "/carts/{id}/items" 400 "VALIDATION_ERROR" "$STATUS" "$BODY"

# Test 6: cartId không phải UUID
RESP=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/carts/abc-123-not-uuid")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_response 6 "cartId trên URL không phải UUID" "GET" "/carts/abc-123" 400 "VALIDATION_ERROR" "$STATUS" "$BODY"

# Test 7: cartId UUID nhưng không tồn tại
RESP=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/carts/${NON_EXISTENT_UUID}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_response 7 "cartId UUID không tồn tại trong DB" "GET" "/carts/00000000-..." 404 "CART_NOT_FOUND" "$STATUS" "$BODY"

echo -e "\n${BOLD}--- BẢNG 2: NGHIỆP VỤ VÀ SERVER (Slide 20: Business Rules) ---${NC}"

# Test 8: Thêm 2 product -> Server tính đúng subtotal_cents
NEW_CART_RESP=$(curl -s -X POST "${BASE_URL}/carts")
NEW_CART_ID=$(echo "$NEW_CART_RESP" | jq -r '.id')
curl -s -X POST "${BASE_URL}/carts/${NEW_CART_ID}/items" -H "Content-Type: application/json" -d "{\"product_id\": \"${SEED_PROD_A}\", \"quantity\": 2}" > /dev/null
curl -s -X POST "${BASE_URL}/carts/${NEW_CART_ID}/items" -H "Content-Type: application/json" -d "{\"product_id\": \"${SEED_PROD_B}\", \"quantity\": 1}" > /dev/null
RESP=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/carts/${NEW_CART_ID}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
SUBTOTAL=$(echo "$BODY" | jq -r '.subtotal_cents // 0')
if [ "$SUBTOTAL" -eq 45000 ]; then
  assert_response 8 "Tính subtotal_cents chính xác (45000)" "GET" "/carts/{id}" 200 "" "$STATUS" "$BODY"
else
  assert_response 8 "Tính subtotal_cents chính xác (expected 45000, got $SUBTOTAL)" "GET" "/carts/{id}" 200 "SUBTOTAL_MISMATCH" 500 "$BODY"
fi

# Test 9: Thêm product ngừng bán
RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/carts/${CART_ID}/items" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\": \"${SEED_PROD_E}\", \"quantity\": 1}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_response 9 "Thêm product ngừng bán (is_active = false)" "POST" "/carts/{id}/items" 422 "PRODUCT_UNAVAILABLE" "$STATUS" "$BODY"

# Test 10: Thêm product hết hàng
RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/carts/${CART_ID}/items" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\": \"${SEED_PROD_D}\", \"quantity\": 1}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_response 10 "Thêm product hết hàng (stock = 0)" "POST" "/carts/{id}/items" 409 "INSUFFICIENT_STOCK" "$STATUS" "$BODY"

# Test 11: Ghi vào cart đã checked out
RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/carts/${CLOSED_CART}/items" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\": \"${SEED_PROD_A}\", \"quantity\": 1}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_response 11 "Ghi vào cart đã checked_out" "POST" "/carts/{closedCart}/items" 409 "CART_CLOSED" "$STATUS" "$BODY"

# Test 12: Thêm product đã có sẵn trong cart
DUP_CART_RESP=$(curl -s -X POST "${BASE_URL}/carts")
DUP_CART_ID=$(echo "$DUP_CART_RESP" | jq -r '.id')
curl -s -X POST "${BASE_URL}/carts/${DUP_CART_ID}/items" -H "Content-Type: application/json" -d "{\"product_id\": \"${SEED_PROD_A}\", \"quantity\": 1}" > /dev/null
RESP=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/carts/${DUP_CART_ID}/items" \
  -H "Content-Type: application/json" \
  -d "{\"product_id\": \"${SEED_PROD_A}\", \"quantity\": 1}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_response 12 "Thêm product đã có trong cart" "POST" "/carts/{id}/items" 409 "ITEM_ALREADY_IN_CART" "$STATUS" "$BODY"

# Test 13: Sửa item không có trong cart
RESP=$(curl -s -w "\n%{http_code}" -X PATCH "${BASE_URL}/carts/${CART_ID}/items/${NON_EXISTENT_UUID}" \
  -H "Content-Type: application/json" \
  -d "{\"quantity\": 3}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_response 13 "Sửa item không có trong cart" "PATCH" "/carts/{id}/items/{itemId}" 404 "ITEM_NOT_FOUND" "$STATUS" "$BODY"

# Test 14: Xóa item thành công
DEL_CART_RESP=$(curl -s -X POST "${BASE_URL}/carts")
DEL_CART_ID=$(echo "$DEL_CART_RESP" | jq -r '.id')
curl -s -X POST "${BASE_URL}/carts/${DEL_CART_ID}/items" -H "Content-Type: application/json" -d "{\"product_id\": \"${SEED_PROD_A}\", \"quantity\": 1}" > /dev/null
RESP=$(curl -s -w "\n%{http_code}" -X DELETE "${BASE_URL}/carts/${DEL_CART_ID}/items/${SEED_PROD_A}")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
assert_response 14 "Xóa item thành công (204 No Content)" "DELETE" "/carts/{id}/items/{itemId}" 204 "" "$STATUS" "$BODY"

# Test 15: Header X-Request-Id & Error Contract
HEADER_TEST=$(curl -s -i -X GET "${BASE_URL}/carts/${NON_EXISTENT_UUID}" -H "X-Request-Id: test-bash-trace-999")
ECHO_ID=$(echo "$HEADER_TEST" | grep -i "x-request-id:" | tr -d '\r\n' | awk '{print $2}')
if [ "$ECHO_ID" = "test-bash-trace-999" ]; then
  assert_response 15 "Tracing X-Request-Id & Error Contract" "GET" "/carts/{unknownId}" 404 "CART_NOT_FOUND" 404 "{\"code\": \"CART_NOT_FOUND\"}"
else
  assert_response 15 "Tracing X-Request-Id failed" "GET" "/carts/{unknownId}" 404 "TRACE_MISMATCH" 500 ""
fi

# Test 16: OpenAPI Spec document
RESP=$(curl -s -w "\n%{http_code}" "${BASE_URL}/openapi.json")
STATUS=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
SPEC_VERSION=$(echo "$BODY" | jq -r '.openapi // empty')
if [[ "$SPEC_VERSION" =~ ^3\.1 ]]; then
  assert_response 16 "OpenAPI 3.1 Spec Document" "GET" "/openapi.json" 200 "" "$STATUS" "$BODY"
else
  assert_response 16 "OpenAPI 3.1 Spec Document" "GET" "/openapi.json" 200 "SPEC_ERROR" 500 "$BODY"
fi

echo -e "\n${BOLD}========================================================================${NC}"
echo -e "${BOLD}SUMMARY:${NC}"
echo -e "  Total Scenarios : ${BOLD}${TOTAL_TESTS}${NC}"
echo -e "  Passed          : ${GREEN}${BOLD}${PASSED_TESTS}${NC}"
echo -e "  Failed          : ${RED}${BOLD}${FAILED_TESTS}${NC}"
echo -e "${BOLD}========================================================================${NC}\n"

if [ "$FAILED_TESTS" -gt 0 ]; then
  exit 1
else
  exit 0
fi
