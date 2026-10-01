# 🎤 KỊCH BẢN BÁO CÁO THUYẾT TRÌNH (SLIDE 22 - PRESENTATION GUIDE)
> **Dự án:** Cart RESTful API - Contract-Driven Backend Architecture  
> **Thời lượng chuẩn:** 5 - 7 phút  
> **Người báo cáo:** Đại diện nhóm (hoặc chia 2 bạn: Bạn 1 [Phần 1, 2], Bạn 2 [Phần 3, 4])

---

## 📌 PHẦN 1 - PROBLEM: ĐẶT VẤN ĐỀ VÀ NỖI ĐAU TÍCH HỢP (1.5 phút)
*(Mục tiêu: Đưa ra vấn đề thực tế từ góc nhìn của một team khác muốn dùng API của mình mà không cần đọc code)*

> **Lời thoại mẫu:**  
> *"Kính thưa Thầy/Cô và các bạn trong lớp,*  
> *Khi hai đội ngũ Frontend/Mobile và Backend làm việc cùng nhau trong một dự án thực tế, một câu hỏi kinh điển luôn được đặt ra là: **Làm thế nào để đội ngũ bên ngoài có thể tích hợp Cart API một cách mượt mà nhất mà không cần phải mở từng dòng mã nguồn Backend ra đọc?***  
>  
> *Thực tế cho thấy, nếu chỉ đưa cho nhau một file Word hoặc một collection Postman xuất thủ công:*  
> 1. *Chỉ sau vài ngày code sửa đổi, tài liệu sẽ ngay lập tức bị **lệch đặc tả (Schema Drift)**.*  
> 2. *Khi Client gửi sai dữ liệu, họ thường nhận về lỗi 500 mơ hồ, hoặc các format lỗi khác nhau tùy tiện của từng thư viện.*  
> 3. *Khi người dùng cuối gặp sự cố trên môi trường thật và báo lên, Backend không có bất kỳ manh mối nào để truy vết vì thiếu mã định danh request (`request_id`).*  
>  
> *Chính vì vậy, đề tài của nhóm em không chỉ đơn thuần là viết các câu lệnh CRUD, mà tập trung giải quyết triệt để bài toán này bằng một kiến trúc chuẩn Contract-Driven: **Single Source of Truth, Boundary Validation chặn lỗi từ cổng, chuẩn hóa Error Contract và Tracing có cấu trúc**."*

---

## 💡 PHẦN 2 - SOLUTION: LỰA CHỌN CÔNG NGHỆ & SINGLE SOURCE OF TRUTH (1.5 phút)
*(Mục tiêu: Trả lời câu hỏi Code-First hay Contract-First? Tại sao? Danh sách thư viện đã chọn)*

> **Lời thoại mẫu:**  
> *"Để giải quyết 4 cạm bẫy kinh điển được nêu trong Slide 21, nhóm em đã phân tích và đưa ra quyết định kiến trúc như sau:*  
>  
> **1. Tiếp cận Code-First hay Contract-First?**  
> *Nhóm em lựa chọn giải pháp **Code-First với TypeScript + Zod**:*  
> *- Nếu chọn Contract-First (viết YAML thủ công), với các API phức tạp việc thụt lề trong YAML rất dễ sai sót, và lập trình viên vẫn phải tốn công viết lại schema lần thứ hai trong code để validate.*  
> *- Với Code-First, Zod Schema trong code đóng vai trò là **MỘT nguồn sự thật duy nhất (Single Source of Truth)**. Schema này vừa trực tiếp kiểm tra dữ liệu ở tầng Gateway (Boundary Validation), vừa tự động biên dịch ra tài liệu **OpenAPI 3.1.0**. Đảm bảo code chạy như thế nào thì tài liệu hiển thị đúng 100% như thế đó, không bao giờ lệch spec.*  
>  
> **2. Bộ công nghệ và lý do lựa chọn:**  
> *- **Zod & @asteasolutions/zod-to-openapi:** Khai báo schema type-safe, cấu hình chế độ nghiêm ngặt `.strict()` để chặn đứng mọi thuộc tính lạ inject từ client.*  
> *- **Scalar API Reference (@scalar/express-api-reference):** Thay vì giao diện Swagger UI cũ, Scalar cung cấp trang `/docs` hiện đại, tương tác mượt mà và trực quan hơn.*  
> *- **Pino & Pino-HTTP:** Thư viện structured logging chuẩn JSON với hiệu năng cao bậc nhất hệ sinh thái Node.js. Nhóm đã cấu hình cơ chế Redaction tự động xóa bỏ các trường nhạy cảm như password, token, header Authorization trước khi ghi log.*  
> *- **PostgreSQL 16 + Kysely:** Type-safe SQL builder, kết hợp Row-Level Lock (`FOR UPDATE`) trong Database Transaction để đảm bảo tính toàn vẹn dữ liệu tồn kho."*

---

## 🖥️ PHẦN 3 - DEMO KỊCH BẢN TRỰC TIẾP (LIVE DEMO - 2 phút)
*(Mục tiêu: Mở `/docs`, cố tình gửi sai để thấy HTTP 400 + request_id, sau đó mở terminal chỉ vào log JSON có cùng request_id)*

> **Thao tác 1: Mở trang tài liệu `/docs`**  
> *(Người trình bày chuyển màn hình sang trình duyệt tại `http://localhost:3000/docs`)*  
> *"Đầu tiên, đây là giao diện tài liệu tương tác tại route `/docs`. Bất kỳ lập trình viên nào nhìn vào đây đều thấy rõ ràng 6 endpoints, cấu trúc body và ví dụ của từng mã HTTP status (từ 200, 201, 204, 400, 404, 409 đến 500). Mọi thông tin này đều được tự động sinh ra từ Zod Schema."*  
>  
> **Thao tác 2: Gửi request cố tình vi phạm nghiệp vụ & schema**  
> *(Mở endpoint `POST /carts/{cartId}/items` trên Scalar UI, nhập payload)*:  
> ```json
> {
>   "product_id": "11111111-1111-1111-1111-111111111111",
>   "quantity": 0,
>   "hacked_field": "attack"
> }
> ```  
> *(Nhấn Execute / Send Request)*  
>  
> **Thao tác 3: Chỉ vào màn hình kết quả trả về**  
> *"Thầy/Cô và các bạn có thể thấy, request bị chặn đứng ngay lập tức tại Boundary Middleware trước khi chạm vào Database:*  
> *- Mã HTTP trả về: **400 Bad Request**.*  
> *- Mã code lỗi: **VALIDATION_ERROR**.*  
> *- Mảng `details` liệt kê chi tiết: `quantity` phải lớn hơn hoặc bằng 1, và trường `hacked_field` không được phép tồn tại.*  
> *- Đặc biệt, có gắn kèm mã truy vết: `request_id: "a5e8f492-9132-..."`."*  
>  
> **Thao tác 4: Chuyển sang Terminal Server đối chiếu Log**  
> *(Chuyển sang cửa sổ Terminal đang chạy `npm run dev`, chỉ chuột vào dòng log JSON mới nhất)*:  
> *"Quan sát terminal của Backend, dòng log được in ra dưới dạng structured JSON chuẩn mực. Tại trường `req_id`, mã hoàn toàn trùng khớp với `request_id` trên màn hình của client. Khi người dùng gặp lỗi và báo mã này, đội ngũ vận hành có thể tìm ra đúng dòng log của request đó trong tích tắc."*

---

## 📊 PHẦN 4 - EVIDENCE & TRADE-OFF (BẰNG CHỨNG & ĐÁNH GIÁ - 1.5 phút)
*(Mục tiêu: Trình chiếu script test xanh 100%, phân tích trade-off và hướng phát triển)*

> **Thao tác 1: Trình chiếu kết quả Ma trận nghiệm thu**  
> *(Mở terminal chạy lệnh)*:  
> ```bash
> npm run test:acceptance
> ```  
> *"Đây là kết quả của script nghiệm thu tự động. Toàn bộ **16/16 test case** từ Slides 19 và 20 đều đạt kết quả xanh lá cây [PASS] 100%: từ việc validate quantity kiểu chuỗi '2', kiểm tra cart đã checked_out, sản phẩm ngừng bán, sản phẩm hết hàng, cho đến việc tính toán `subtotal_cents` hoàn toàn phía server từ giá trong database mà không tin client."*  
>  
> **Thao tác 2: Nêu rõ các Trade-off kỹ thuật đã cân nhắc**  
> *"Cuối cùng, nhóm em muốn chia sẻ 2 trade-off quan trọng trong quá trình thiết kế:*  
> 1. *Về kiến trúc Schema:* Lựa chọn Code-First giúp developer có trải nghiệm type-safety tốt nhất trong TypeScript, nhưng sẽ phụ thuộc vào ngôn ngữ lập trình. Nếu sau này công ty có nhiều service viết bằng Go hay Java cùng chia sẻ schema, lúc đó nhóm sẽ cân nhắc chuyển sang Contract-First với Protobuf/gRPC hoặc OpenAPI YAML tập trung.  
> 2. *Về quản lý cạnh tranh (Concurrency & Race Condition):* Hiện tại nhóm đã xử lý bài toán tranh chấp tồn kho bằng `SELECT ... FOR UPDATE` trong transaction của PostgreSQL. Điều này đáp ứng rất tốt cho các hệ thống vừa và nhỏ. Tuy nhiên, nếu gặp các sự kiện Flash Sale hàng chục ngàn người cùng bấm mua 1 sản phẩm cuối cùng, giải pháp tối ưu hơn trong tương lai là sử dụng Redis Distributed Lock kết hợp Message Queue để dàn hàng ngang request.  
>  
> *Nhóm em xin chân thành cảm ơn Thầy/Cô và các bạn đã chú ý lắng nghe. Nhóm em rất mong nhận được câu hỏi và đóng góp ý kiến!"*
