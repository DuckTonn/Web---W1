import app from '../src/app';
import { pool, testDbConnection } from '../src/db';
import { Server } from 'http';

// ANSI Color Codes
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';

interface TestResult {
  num: number;
  name: string;
  method: string;
  path: string;
  expectedStatus: number;
  actualStatus: number;
  expectedCode?: string;
  actualCode?: string;
  passed: boolean;
  notes?: string;
}

const SEED_PRODUCT_A = '11111111-1111-1111-1111-111111111111'; // Price: 10000, Stock: 20, Active: true
const SEED_PRODUCT_B = '22222222-2222-2222-2222-222222222222'; // Price: 25000, Stock: 5, Active: true
const SEED_PRODUCT_D = '44444444-4444-4444-4444-444444444444'; // Stock: 0, Active: true
const SEED_PRODUCT_E = '55555555-5555-5555-5555-555555555555'; // Active: false (discontinued)
const SEED_CLOSED_CART = '99999999-9999-9999-9999-999999999999'; // Status: 'checked_out'
const NON_EXISTENT_UUID = '00000000-0000-0000-0000-000000000000';

async function main() {
  console.log(`\n${BOLD}${CYAN}========================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   CART RESTFUL API - AUTOMATED ACCEPTANCE TEST MATRIX (SLIDES 19 & 20)  ${RESET}`);
  console.log(`${BOLD}${CYAN}========================================================================${RESET}\n`);

  // Check Database connection
  const isDbLive = await testDbConnection();
  let originalQuery = pool.query.bind(pool);
  let originalConnect = pool.connect.bind(pool);

  if (isDbLive) {
    console.log(`${GREEN}✔ PostgreSQL Database connected successfully (Live DB Mode).${RESET}\n`);
  } else {
    console.log(
      `${YELLOW}⚠ PostgreSQL connection not detected (PostgreSQL container may be stopped).${RESET}`
    );
    console.log(`${CYAN}ℹ Activating resilient mock store seeded with exact standard test data.${RESET}\n`);

    // In-memory mock store adhering to exact seed data
    const mockStore = {
      products: [
        { id: SEED_PRODUCT_A, name: 'Product A (Mechanical Keyboard)', price_cents: 10000, stock: 20, is_active: true },
        { id: SEED_PRODUCT_B, name: 'Product B (Gaming Mouse)', price_cents: 25000, stock: 5, is_active: true },
        { id: '33333333-3333-3333-3333-333333333333', name: 'Product C (USB-C Hub)', price_cents: 50000, stock: 15, is_active: true },
        { id: SEED_PRODUCT_D, name: 'Product D (Headphones - Out of Stock)', price_cents: 12000, stock: 0, is_active: true },
        { id: SEED_PRODUCT_E, name: 'Product E (Smart Watch - Discontinued)', price_cents: 30000, stock: 10, is_active: false },
      ],
      carts: [
        { id: SEED_CLOSED_CART, status: 'checked_out', created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ] as any[],
      cart_items: [] as any[],
    };

    pool.query = (async (text: string, params?: any[]) => {
      const sql = text.replace(/\s+/g, ' ').toUpperCase();
      if (sql.includes('FROM PRODUCTS') && sql.includes('IS_ACTIVE = TRUE')) {
        return { rows: mockStore.products.filter((p) => p.is_active) };
      }
      if (sql.includes('FROM CARTS WHERE ID = $1')) {
        const cart = mockStore.carts.find((c) => c.id === params?.[0]);
        return { rows: cart ? [cart] : [] };
      }
      if (sql.includes('FROM CART_ITEMS CI JOIN PRODUCTS P')) {
        const items = mockStore.cart_items
          .filter((ci) => ci.cart_id === params?.[0])
          .map((ci) => {
            const p = mockStore.products.find((prod) => prod.id === ci.product_id)!;
            return {
              product_id: ci.product_id,
              name: p.name,
              unit_price_cents: p.price_cents,
              quantity: ci.quantity,
            };
          });
        return { rows: items };
      }
      if (sql.includes('INSERT INTO CARTS')) {
        const newCart = {
          id: crypto.randomUUID(),
          status: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        mockStore.carts.push(newCart);
        return { rows: [newCart] };
      }
      return { rows: [] };
    }) as any;

    pool.connect = (async () => {
      return {
        query: async (text: string, params?: any[]) => {
          const sql = text.replace(/\s+/g, ' ').toUpperCase();
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
            return { rows: [] };
          }
          if (sql.includes('FROM CARTS WHERE ID = $1')) {
            const cart = mockStore.carts.find((c) => c.id === params?.[0]);
            return { rows: cart ? [cart] : [] };
          }
          if (sql.includes('FROM PRODUCTS WHERE ID = $1')) {
            const p = mockStore.products.find((prod) => prod.id === params?.[0]);
            return { rows: p ? [p] : [] };
          }
          if (sql.includes('FROM CART_ITEMS WHERE CART_ID = $1 AND PRODUCT_ID = $2')) {
            const item = mockStore.cart_items.find(
              (ci) => ci.cart_id === params?.[0] && ci.product_id === params?.[1]
            );
            return { rows: item ? [item] : [] };
          }
          if (sql.includes('INSERT INTO CART_ITEMS')) {
            const newItem = {
              id: crypto.randomUUID(),
              cart_id: params?.[0],
              product_id: params?.[1],
              quantity: params?.[2],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            mockStore.cart_items.push(newItem);
            return { rows: [newItem] };
          }
          if (sql.includes('UPDATE CART_ITEMS')) {
            const item = mockStore.cart_items.find(
              (ci) => ci.cart_id === params?.[1] && ci.product_id === params?.[2]
            );
            if (item) item.quantity = params?.[0];
            return { rows: [] };
          }
          if (sql.includes('DELETE FROM CART_ITEMS')) {
            const index = mockStore.cart_items.findIndex(
              (ci) => ci.cart_id === params?.[0] && ci.product_id === params?.[1]
            );
            if (index !== -1) mockStore.cart_items.splice(index, 1);
            return { rows: [] };
          }
          return { rows: [] };
        },
        release: () => {},
      };
    }) as any;
  }

  // Start internal test server
  const testPort = 3096;
  const server: Server = app.listen(testPort);
  const baseUrl = `http://localhost:${testPort}`;
  const results: TestResult[] = [];

  try {
    // ---------------------------------------------------------
    // Helper function to create a new fresh cart for test cases
    // ---------------------------------------------------------
    const createFreshCart = async (): Promise<string> => {
      const res = await fetch(`${baseUrl}/carts`, { method: 'POST' });
      const data = (await res.json()) as any;
      return data.id;
    };

    const activeCartId = await createFreshCart();

    // ---------------------------------------------------------
    // BẢNG 1: REQUEST SAI (Slide 19)
    // ---------------------------------------------------------
    console.log(`${BOLD}--- BẢNG 1: REQUEST SAI (Slide 19: Boundary Validation) ---${RESET}`);

    // Test 1: Quantity = 0
    {
      const res = await fetch(`${baseUrl}/carts/${activeCartId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: SEED_PRODUCT_A, quantity: 0 }),
      });
      const body = (await res.json()) as any;
      const passed =
        res.status === 400 &&
        body.code === 'VALIDATION_ERROR' &&
        body.details?.some((d: any) => d.field === 'quantity');
      results.push({
        num: 1,
        name: 'quantity bằng 0 khi thêm item',
        method: 'POST',
        path: `/carts/{id}/items`,
        expectedStatus: 400,
        actualStatus: res.status,
        expectedCode: 'VALIDATION_ERROR',
        actualCode: body.code,
        passed,
      });
    }

    // Test 2: Quantity = 11
    {
      const res = await fetch(`${baseUrl}/carts/${activeCartId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: SEED_PRODUCT_A, quantity: 11 }),
      });
      const body = (await res.json()) as any;
      const passed =
        res.status === 400 &&
        body.code === 'VALIDATION_ERROR' &&
        body.details?.some((d: any) => d.field === 'quantity');
      results.push({
        num: 2,
        name: 'quantity bằng 11 (vượt max 10)',
        method: 'POST',
        path: `/carts/{id}/items`,
        expectedStatus: 400,
        actualStatus: res.status,
        expectedCode: 'VALIDATION_ERROR',
        actualCode: body.code,
        passed,
      });
    }

    // Test 3: Quantity = "2" (String type)
    {
      const res = await fetch(`${baseUrl}/carts/${activeCartId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: SEED_PRODUCT_A, quantity: '2' }),
      });
      const body = (await res.json()) as any;
      const passed =
        res.status === 400 &&
        body.code === 'VALIDATION_ERROR' &&
        body.details?.some((d: any) => d.field === 'quantity');
      results.push({
        num: 3,
        name: 'quantity là chuỗi "2" (type mismatch)',
        method: 'POST',
        path: `/carts/{id}/items`,
        expectedStatus: 400,
        actualStatus: res.status,
        expectedCode: 'VALIDATION_ERROR',
        actualCode: body.code,
        passed,
      });
    }

    // Test 4: Thiếu product_id trong body
    {
      const res = await fetch(`${baseUrl}/carts/${activeCartId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 2 }),
      });
      const body = (await res.json()) as any;
      const passed =
        res.status === 400 &&
        body.code === 'VALIDATION_ERROR' &&
        body.details?.some((d: any) => d.field === 'product_id');
      results.push({
        num: 4,
        name: 'Thiếu trường product_id trong body',
        method: 'POST',
        path: `/carts/{id}/items`,
        expectedStatus: 400,
        actualStatus: res.status,
        expectedCode: 'VALIDATION_ERROR',
        actualCode: body.code,
        passed,
      });
    }

    // Test 5: Body có field lạ (Strict mode / additionalProperties: false)
    {
      const res = await fetch(`${baseUrl}/carts/${activeCartId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: SEED_PRODUCT_A,
          quantity: 2,
          foo: 'bar',
        }),
      });
      const body = (await res.json()) as any;
      const passed =
        res.status === 400 &&
        body.code === 'VALIDATION_ERROR' &&
        body.details?.some((d: any) => d.field === 'foo');
      results.push({
        num: 5,
        name: 'Body chứa field lạ (chặn additional properties)',
        method: 'POST',
        path: `/carts/{id}/items`,
        expectedStatus: 400,
        actualStatus: res.status,
        expectedCode: 'VALIDATION_ERROR',
        actualCode: body.code,
        passed,
      });
    }

    // Test 6: cartId không phải UUID
    {
      const res = await fetch(`${baseUrl}/carts/abc-123-not-uuid/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: SEED_PRODUCT_A, quantity: 2 }),
      });
      const body = (await res.json()) as any;
      const passed =
        res.status === 400 &&
        body.code === 'VALIDATION_ERROR' &&
        body.details?.some((d: any) => d.field === 'cartId');
      results.push({
        num: 6,
        name: 'cartId trên URL sai định dạng UUID',
        method: 'POST',
        path: `/carts/abc-123/items`,
        expectedStatus: 400,
        actualStatus: res.status,
        expectedCode: 'VALIDATION_ERROR',
        actualCode: body.code,
        passed,
      });
    }

    // Test 7: cartId đúng định dạng UUID nhưng không tồn tại trong DB
    {
      const res = await fetch(`${baseUrl}/carts/${NON_EXISTENT_UUID}`);
      const body = (await res.json()) as any;
      const passed = res.status === 404 && body.code === 'CART_NOT_FOUND';
      results.push({
        num: 7,
        name: 'cartId UUID hợp lệ nhưng không tồn tại',
        method: 'GET',
        path: `/carts/00000000-...`,
        expectedStatus: 404,
        actualStatus: res.status,
        expectedCode: 'CART_NOT_FOUND',
        actualCode: body.code,
        passed,
      });
    }

    // ---------------------------------------------------------
    // BẢNG 2: NGHIỆP VỤ VÀ SERVER (Slide 20)
    // ---------------------------------------------------------
    console.log(`\n${BOLD}--- BẢNG 2: NGHIỆP VỤ VÀ SERVER (Slide 20: Business Rules) ---${RESET}`);

    // Test 8: Tạo cart mới -> Thêm 2 product -> Tính subtotal_cents chính xác
    {
      const orderCartId = await createFreshCart();
      // Add Product A: qty 2, price 10000 -> 20000
      await fetch(`${baseUrl}/carts/${orderCartId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: SEED_PRODUCT_A, quantity: 2 }),
      });
      // Add Product B: qty 1, price 25000 -> 25000
      await fetch(`${baseUrl}/carts/${orderCartId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: SEED_PRODUCT_B, quantity: 1 }),
      });

      // GET cart details
      const getRes = await fetch(`${baseUrl}/carts/${orderCartId}`);
      const cartData = (await getRes.json()) as any;

      // Expected subtotal = 10000 * 2 + 25000 * 1 = 45000 cents
      const expectedSubtotal = 45000;
      const passed =
        getRes.status === 200 &&
        cartData.items?.length === 2 &&
        cartData.subtotal_cents === expectedSubtotal;

      results.push({
        num: 8,
        name: 'Thêm 2 items -> Server tính đúng subtotal_cents',
        method: 'GET',
        path: `/carts/{id}`,
        expectedStatus: 200,
        actualStatus: getRes.status,
        expectedCode: 'subtotal=45000',
        actualCode: `subtotal=${cartData.subtotal_cents}`,
        passed,
      });
    }

    // Test 9: Thêm product ngừng bán (is_active = false)
    {
      const res = await fetch(`${baseUrl}/carts/${activeCartId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: SEED_PRODUCT_E, quantity: 1 }),
      });
      const body = (await res.json()) as any;
      const passed = res.status === 422 && body.code === 'PRODUCT_UNAVAILABLE';
      results.push({
        num: 9,
        name: 'Thêm sản phẩm đã ngừng bán (is_active = false)',
        method: 'POST',
        path: `/carts/{id}/items`,
        expectedStatus: 422,
        actualStatus: res.status,
        expectedCode: 'PRODUCT_UNAVAILABLE',
        actualCode: body.code,
        passed,
      });
    }

    // Test 10: Thêm sản phẩm vượt tồn kho (stock = 0)
    {
      const res = await fetch(`${baseUrl}/carts/${activeCartId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: SEED_PRODUCT_D, quantity: 1 }),
      });
      const body = (await res.json()) as any;
      const passed = res.status === 409 && body.code === 'INSUFFICIENT_STOCK';
      results.push({
        num: 10,
        name: 'Thêm sản phẩm hết hàng (quantity > stock=0)',
        method: 'POST',
        path: `/carts/{id}/items`,
        expectedStatus: 409,
        actualStatus: res.status,
        expectedCode: 'INSUFFICIENT_STOCK',
        actualCode: body.code,
        passed,
      });
    }

    // Test 11: Ghi vào cart đã checkout (status = 'checked_out')
    {
      const res = await fetch(`${baseUrl}/carts/${SEED_CLOSED_CART}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: SEED_PRODUCT_A, quantity: 1 }),
      });
      const body = (await res.json()) as any;
      const passed = res.status === 409 && body.code === 'CART_CLOSED';
      results.push({
        num: 11,
        name: 'Ghi vào cart đã đóng (status: checked_out)',
        method: 'POST',
        path: `/carts/{closedCartId}/items`,
        expectedStatus: 409,
        actualStatus: res.status,
        expectedCode: 'CART_CLOSED',
        actualCode: body.code,
        passed,
      });
    }

    // Test 12: Thêm product đã có trong cart (tránh trùng lặp)
    {
      const dupCartId = await createFreshCart();
      // Add first time
      await fetch(`${baseUrl}/carts/${dupCartId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: SEED_PRODUCT_A, quantity: 1 }),
      });
      // Add second time
      const dupRes = await fetch(`${baseUrl}/carts/${dupCartId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: SEED_PRODUCT_A, quantity: 1 }),
      });
      const body = (await dupRes.json()) as any;
      const passed = dupRes.status === 409 && body.code === 'ITEM_ALREADY_IN_CART';
      results.push({
        num: 12,
        name: 'Thêm sản phẩm đã có sẵn trong cart',
        method: 'POST',
        path: `/carts/{id}/items`,
        expectedStatus: 409,
        actualStatus: dupRes.status,
        expectedCode: 'ITEM_ALREADY_IN_CART',
        actualCode: body.code,
        passed,
      });
    }

    // Test 13: Sửa / Xóa item không có trong cart
    {
      const res = await fetch(`${baseUrl}/carts/${activeCartId}/items/${NON_EXISTENT_UUID}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 2 }),
      });
      const body = (await res.json()) as any;
      const passed = res.status === 404 && body.code === 'ITEM_NOT_FOUND';
      results.push({
        num: 13,
        name: 'Cập nhật item không tồn tại trong cart',
        method: 'PATCH',
        path: `/carts/{id}/items/{unknownId}`,
        expectedStatus: 404,
        actualStatus: res.status,
        expectedCode: 'ITEM_NOT_FOUND',
        actualCode: body.code,
        passed,
      });
    }

    // Test 14: Xóa item hợp lệ (204 No Content)
    {
      const delCartId = await createFreshCart();
      await fetch(`${baseUrl}/carts/${delCartId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: SEED_PRODUCT_A, quantity: 1 }),
      });

      const delRes = await fetch(`${baseUrl}/carts/${delCartId}/items/${SEED_PRODUCT_A}`, {
        method: 'DELETE',
      });
      const text = await delRes.text();
      const passed = delRes.status === 204 && text.length === 0;
      results.push({
        num: 14,
        name: 'Xóa item thành công (204 No Content, body rỗng)',
        method: 'DELETE',
        path: `/carts/{id}/items/{prodId}`,
        expectedStatus: 204,
        actualStatus: delRes.status,
        expectedCode: 'NO_CONTENT',
        actualCode: delRes.status === 204 ? 'NO_CONTENT' : 'HAS_BODY',
        passed,
      });
    }

    // Test 15: Header X-Request-Id & Structured Error Format
    {
      const customReqId = 'trace-check-uuid-999';
      const res = await fetch(`${baseUrl}/carts/${NON_EXISTENT_UUID}`, {
        headers: { 'X-Request-Id': customReqId },
      });
      const echoHeader = res.headers.get('x-request-id');
      const body = (await res.json()) as any;
      const passed =
        echoHeader === customReqId &&
        Boolean(body.code) &&
        Boolean(body.message) &&
        body.request_id === customReqId;

      results.push({
        num: 15,
        name: 'Tracing X-Request-Id & Chuẩn hóa Error Contract',
        method: 'GET',
        path: `/carts/{unknownId}`,
        expectedStatus: 404,
        actualStatus: res.status,
        expectedCode: 'request_id echoed',
        actualCode: echoHeader === customReqId ? 'request_id echoed' : 'mismatch',
        passed,
      });
    }

    // Test 16: OpenAPI Spec & Docs Endpoint
    {
      const res = await fetch(`${baseUrl}/openapi.json`);
      const spec = (await res.json()) as any;
      const passed =
        res.status === 200 &&
        spec.openapi?.startsWith('3.1') &&
        Boolean(spec.paths['/products']) &&
        Boolean(spec.paths['/carts']) &&
        Boolean(spec.paths['/carts/{cartId}']);

      results.push({
        num: 16,
        name: 'OpenAPI 3.1 Spec Document chứa đủ 6 endpoints',
        method: 'GET',
        path: `/openapi.json`,
        expectedStatus: 200,
        actualStatus: res.status,
        expectedCode: 'OpenAPI 3.1',
        actualCode: spec.openapi || 'UNKNOWN',
        passed,
      });
    }

    // ---------------------------------------------------------
    // DISPLAY REPORT TABLE
    // ---------------------------------------------------------
    console.log(`\n${BOLD}========================================================================${RESET}`);
    console.log(`${BOLD}                       ACCEPTANCE TEST MATRIX RESULTS                   ${RESET}`);
    console.log(`${BOLD}========================================================================${RESET}`);

    for (const r of results) {
      const statusTag = r.passed
        ? `${GREEN}${BOLD}[PASS]${RESET}`
        : `${RED}${BOLD}[FAIL]${RESET}`;
      const codeInfo = r.expectedCode
        ? `${GRAY}(Exp: ${r.expectedStatus} ${r.expectedCode} | Got: ${r.actualStatus} ${r.actualCode || ''})${RESET}`
        : `${GRAY}(Exp: ${r.expectedStatus} | Got: ${r.actualStatus})${RESET}`;

      console.log(
        ` ${statusTag} #${String(r.num).padStart(2, ' ')} [${r.method.padEnd(6, ' ')} ${r.path.padEnd(25, ' ')}] ${r.name}\n       ${codeInfo}`
      );
    }

    // Summary calculation
    const total = results.length;
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = total - passedCount;
    const percent = ((passedCount / total) * 100).toFixed(1);

    console.log(`\n${BOLD}========================================================================${RESET}`);
    console.log(`${BOLD}SUMMARY:${RESET}`);
    console.log(`  Total Scenarios : ${BOLD}${total}${RESET}`);
    console.log(`  Passed          : ${GREEN}${BOLD}${passedCount}${RESET}`);
    console.log(`  Failed          : ${failedCount > 0 ? RED : GREEN}${BOLD}${failedCount}${RESET}`);
    console.log(`  Success Rate    : ${GREEN}${BOLD}${percent}%${RESET}`);
    console.log(`${BOLD}========================================================================${RESET}\n`);

    if (failedCount > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } finally {
    pool.query = originalQuery;
    pool.connect = originalConnect;
    server.close();
  }
}

main().catch((err) => {
  console.error(`${RED}Fatal error running acceptance tests:${RESET}`, err);
  process.exit(1);
});
