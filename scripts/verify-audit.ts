import app from '../src/app';
import { pool } from '../src/db';
import {
  ProductListResponseSchema,
  CartResponseSchema,
  ErrorResponseSchema,
} from '../src/schemas';
import { Server } from 'http';

// ANSI Colors
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';

interface AuditCheck {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  details: string;
}

const auditChecks: AuditCheck[] = [];

function recordAudit(id: string, category: string, name: string, passed: boolean, details: string) {
  auditChecks.push({ id, category, name, passed, details });
  const badge = passed ? `${GREEN}${BOLD}[PASS]${RESET}` : `${RED}${BOLD}[FAIL]${RESET}`;
  console.log(` ${badge} ${category.padEnd(16, ' ')} | ${name}\n        ${details}`);
}

async function runAudit() {
  console.log(`\n${BOLD}${CYAN}========================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}     CART API - CODE AUDIT, SECURITY & ROBUSTNESS VERIFICATION          ${RESET}`);
  console.log(`${BOLD}${CYAN}  (Auditing against Slide 20 Server Errors & Slide 21 Classic Pitfalls)  ${RESET}`);
  console.log(`${BOLD}${CYAN}========================================================================${RESET}\n`);

  const serverPort = 3095;
  const server: Server = app.listen(serverPort);
  const baseUrl = `http://localhost:${serverPort}`;

  const originalQuery = pool.query.bind(pool);
  const originalConnect = pool.connect.bind(pool);

  try {
    // =========================================================================
    // 1. AUDIT CHECK: LỖI 500 KHI DATABASE BỊ NGẮT KẾT NỐI (Slide 20)
    // =========================================================================
    console.log(`${BOLD}--- 1. AUDIT: DATABASE DISCONNECTION & 500 ERROR LEAK PREVENTION ---${RESET}`);

    // Mock Database complete failure (like 'docker compose stop postgres')
    pool.query = (async () => {
      const dbError: any = new Error('connect ECONNREFUSED 127.0.0.1:5432');
      dbError.code = 'ECONNREFUSED';
      dbError.query = 'SELECT * FROM products WHERE is_active = TRUE';
      throw dbError;
    }) as any;

    pool.connect = (async () => {
      const dbError: any = new Error('connect ECONNREFUSED 127.0.0.1:5432');
      dbError.code = 'ECONNREFUSED';
      throw dbError;
    }) as any;

    const dbDownReqId = 'audit-db-down-trace-999';
    const dbDownRes = await fetch(`${baseUrl}/products`, {
      headers: { 'X-Request-Id': dbDownReqId },
    });
    const dbDownBody = (await dbDownRes.json()) as any;
    const rawBodyString = JSON.stringify(dbDownBody);

    // a. HTTP 500 Status
    recordAudit(
      'AUDIT-500-STATUS',
      'Database Error',
      'Trả về HTTP 500 khi Database bị ngắt kết nối',
      dbDownRes.status === 500,
      `Expected status 500, received ${dbDownRes.status}`
    );

    // b. Error Contract Format
    const isStandard500 =
      dbDownBody.code === 'INTERNAL_SERVER_ERROR' &&
      dbDownBody.message === 'Internal server error' &&
      dbDownBody.request_id === dbDownReqId;
    recordAudit(
      'AUDIT-500-CONTRACT',
      'Database Error',
      'Body tuân thủ đúng Error Contract (code, message, request_id)',
      isStandard500,
      `Received code="${dbDownBody.code}", message="${dbDownBody.message}", request_id="${dbDownBody.request_id}"`
    );

    // c. Zero Information Leakage (No stack trace, No SQL, No credentials)
    const hasStackLeak = Boolean(dbDownBody.stack);
    const hasSqlLeak = rawBodyString.includes('SELECT') || rawBodyString.includes('products');
    const hasDbConnLeak = rawBodyString.includes('ECONNREFUSED') || rawBodyString.includes('5432');
    const noLeakage = !hasStackLeak && !hasSqlLeak && !hasDbConnLeak;

    recordAudit(
      'AUDIT-500-NO-LEAK',
      'Security',
      'TUYỆT ĐỐI KHÔNG chứa stack trace, câu query SQL hay thông tin pool/port trong body',
      noLeakage,
      noLeakage
        ? 'Clean! Zero technical details leaked to client'
        : `LEAK DETECTED! stack:${hasStackLeak}, sql:${hasSqlLeak}, conn:${hasDbConnLeak}`
    );

    // =========================================================================
    // 2. AUDIT CHECK: BẪY LỖI THƯ VIỆN LỌT RA NGOÀI (Slide 21 Pitfall #2)
    // =========================================================================
    console.log(`\n${BOLD}--- 2. AUDIT: PREVENTING LIBRARY ERRORS LEAKAGE (Slide 21 #2) ---${RESET}`);

    // a. Malformed JSON syntax error in request body
    const malformedTraceId = 'audit-malformed-json-888';
    const malformedRes = await fetch(`${baseUrl}/carts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': malformedTraceId,
      },
      body: '{"quantity": ',
    });
    const malformedBody = (await malformedRes.json()) as any;

    const isSyntaxHandled =
      malformedRes.status === 400 &&
      malformedBody.code === 'VALIDATION_ERROR' &&
      malformedBody.message === 'Invalid JSON payload in request body' &&
      malformedBody.request_id === malformedTraceId;

    recordAudit(
      'AUDIT-MALFORMED-JSON',
      'Library Trap',
      'Bắt lỗi express.json() SyntaxError chuẩn hóa về 400 VALIDATION_ERROR',
      isSyntaxHandled,
      `Status: ${malformedRes.status}, code: ${malformedBody.code}, message: "${malformedBody.message}"`
    );

    // b. Zod raw validation error sanitization
    const zodTraceId = 'audit-zod-sanitized-777';
    const zodRes = await fetch(`${baseUrl}/carts/invalid-uuid-format/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': zodTraceId,
      },
      body: JSON.stringify({ product_id: 'not-uuid', quantity: 'string_qty' }),
    });
    const zodBody = (await zodRes.json()) as any;

    // Must be unified error contract with array of details, not ZodError object
    const isZodSanitized =
      zodRes.status === 400 &&
      zodBody.code === 'VALIDATION_ERROR' &&
      zodBody.message === 'Validation failed' &&
      Array.isArray(zodBody.details) &&
      !zodBody.issues && // Zod raw property 'issues' must not be exposed at top level
      !zodBody.name; // ZodError.name must not be exposed

    recordAudit(
      'AUDIT-ZOD-SANITIZE',
      'Library Trap',
      'Lỗi Zod được bóc tách và chuẩn hóa, không để lộ cấu trúc raw của thư viện',
      isZodSanitized,
      `Details count: ${zodBody.details?.length || 0}, raw properties omitted: true`
    );

    // =========================================================================
    // 3. AUDIT CHECK: SO KHỚP RESPONSE THỰC TẾ VỚI OPENAPI 3.1 SPEC (Slide 20)
    // =========================================================================
    console.log(`\n${BOLD}--- 3. AUDIT: MATCHING ACTUAL RESPONSES AGAINST OPENAPI SCHEMA ---${RESET}`);

    // Reconnect mock database with proper data for response checking
    const sampleProduct = {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Mechanical Keyboard TKL',
      price_cents: 10000,
      stock: 20,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const sampleCart = {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    pool.query = (async (text: string) => {
      const sql = text.replace(/\s+/g, ' ').toUpperCase();
      if (sql.includes('FROM PRODUCTS WHERE IS_ACTIVE = TRUE')) {
        return { rows: [sampleProduct] };
      }
      if (sql.includes('FROM CARTS WHERE ID = $1')) {
        return { rows: [sampleCart] };
      }
      if (sql.includes('FROM CART_ITEMS CI JOIN PRODUCTS P')) {
        return {
          rows: [
            {
              product_id: sampleProduct.id,
              name: sampleProduct.name,
              unit_price_cents: sampleProduct.price_cents,
              quantity: 2,
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO CARTS')) {
        return { rows: [sampleCart] };
      }
      return { rows: [] };
    }) as any;

    pool.connect = (async () => ({
      query: async (text: string) => {
        const sql = text.replace(/\s+/g, ' ').toUpperCase();
        if (sql.includes('FROM CARTS WHERE ID = $1')) {
          return { rows: [sampleCart] };
        }
        if (sql.includes('FROM CART_ITEMS WHERE CART_ID = $1')) {
          return { rows: [{ id: 'item-1', quantity: 2 }] };
        }
        return { rows: [] };
      },
      release: () => {},
    })) as any;

    // a. GET /products schema validation
    const prodRes = await fetch(`${baseUrl}/products`);
    const prodData = await prodRes.json();
    const prodParse = ProductListResponseSchema.safeParse(prodData);
    recordAudit(
      'AUDIT-SCHEMA-PRODUCTS',
      'Schema Match',
      'Response GET /products khớp 100% ProductListResponseSchema',
      prodParse.success,
      prodParse.success ? 'Schema valid' : `Error: ${JSON.stringify(prodParse.error?.issues)}`
    );

    // b. POST /carts schema validation & Location header
    const cartCreateRes = await fetch(`${baseUrl}/carts`, { method: 'POST' });
    const cartCreateData = await cartCreateRes.json();
    const cartCreateParse = CartResponseSchema.safeParse(cartCreateData);
    const locationHeader = cartCreateRes.headers.get('location');

    recordAudit(
      'AUDIT-SCHEMA-POST-CART',
      'Schema Match',
      'Response POST /carts khớp CartResponseSchema và có Location header',
      cartCreateParse.success && Boolean(locationHeader),
      `Location: ${locationHeader}, Schema valid: ${cartCreateParse.success}`
    );

    // c. GET /carts/{cartId} schema validation
    const cartGetRes = await fetch(`${baseUrl}/carts/${sampleCart.id}`);
    const cartGetData = await cartGetRes.json();
    const cartGetParse = CartResponseSchema.safeParse(cartGetData);

    recordAudit(
      'AUDIT-SCHEMA-GET-CART',
      'Schema Match',
      'Response GET /carts/{id} khớp CartResponseSchema',
      cartGetParse.success,
      cartGetParse.success ? 'Schema valid' : `Error: ${JSON.stringify(cartGetParse.error?.issues)}`
    );

    // d. Null vs Undefined check (Slide 8)
    // In CartResponse: items must be an array (never null), subtotal_cents must be number (never null)
    const hasNullItems = cartGetData.items === null;
    const hasNullSubtotal = cartGetData.subtotal_cents === null;
    const isCleanNullTypes = !hasNullItems && !hasNullSubtotal && typeof cartGetData.subtotal_cents === 'number';

    recordAudit(
      'AUDIT-NULL-TYPES',
      'Slide 8 Quality',
      'Kiểm tra null vs undefined: items luôn là mảng, subtotal_cents là số, không chứa null bất thường',
      isCleanNullTypes,
      `items isArray: ${Array.isArray(cartGetData.items)}, subtotal_cents type: ${typeof cartGetData.subtotal_cents}`
    );

    // e. DELETE 204 No Content empty body check
    const deleteRes = await fetch(`${baseUrl}/carts/${sampleCart.id}/items/${sampleProduct.id}`, {
      method: 'DELETE',
    });
    const deleteText = await deleteRes.text();
    const isClean204 = deleteRes.status === 204 && deleteText.length === 0;

    recordAudit(
      'AUDIT-DELETE-204',
      'Contract Quality',
      'DELETE endpoint trả về đúng HTTP 204 No Content với body hoàn toàn rỗng (0 bytes)',
      isClean204,
      `Status: ${deleteRes.status}, Body length: ${deleteText.length} bytes`
    );

    // =========================================================================
    // 4. AUDIT CHECK: BẢO VỆ DỮ LIỆU NHẠY CẢM VÀ KHÔNG TIN TƯỞNG CLIENT
    // =========================================================================
    console.log(`\n${BOLD}--- 4. AUDIT: UNTRUSTED CLIENT & PRICE INTEGRITY (Slide 21 #3) ---${RESET}`);

    // Client sends fake malicious price_cents: 1
    const fakePriceRes = await fetch(`${baseUrl}/carts/${sampleCart.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: sampleProduct.id,
        quantity: 2,
        price_cents: 1, // Malicious client attempt to pay 1 cent
      }),
    });
    const fakePriceBody = (await fakePriceRes.json()) as any;

    // Strict mode should reject 'price_cents' as an extra field immediately!
    const isPriceTamperingBlocked =
      fakePriceRes.status === 400 &&
      fakePriceBody.code === 'VALIDATION_ERROR' &&
      fakePriceBody.details?.some((d: any) => d.field === 'price_cents');

    recordAudit(
      'AUDIT-CLIENT-PRICE',
      'Slide 21 #3',
      'Không tin client: Chặn field price_cents gửi từ client, giá tiền được tính 100% từ DB',
      isPriceTamperingBlocked,
      isPriceTamperingBlocked
        ? 'Protected: Injected client price was strictly rejected at gateway'
        : 'VULNERABILITY: Client price was accepted!'
    );

    // ---------------------------------------------------------
    // SUMMARY
    // ---------------------------------------------------------
    console.log(`\n${BOLD}========================================================================${RESET}`);
    console.log(`${BOLD}                       CODE AUDIT FINAL SUMMARY                         ${RESET}`);
    console.log(`${BOLD}========================================================================${RESET}`);

    const totalAudit = auditChecks.length;
    const passedAudit = auditChecks.filter((c) => c.passed).length;
    const failedAudit = totalAudit - passedAudit;
    const rate = ((passedAudit / totalAudit) * 100).toFixed(1);

    console.log(`  Total Audit Criteria : ${BOLD}${totalAudit}${RESET}`);
    console.log(`  Compliant (Passed)   : ${GREEN}${BOLD}${passedAudit}${RESET}`);
    console.log(`  Violations (Failed)  : ${failedAudit > 0 ? RED : GREEN}${BOLD}${failedAudit}${RESET}`);
    console.log(`  Compliance Score     : ${GREEN}${BOLD}${rate}%${RESET}`);
    console.log(`${BOLD}========================================================================${RESET}\n`);

    if (failedAudit > 0) {
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

runAudit().catch((err) => {
  console.error(`${RED}Fatal error during code audit:${RESET}`, err);
  process.exit(1);
});
