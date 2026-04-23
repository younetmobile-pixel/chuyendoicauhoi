import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `
BẠN LÀ MÁY QUÉT VÀ PHÂN TÍCH ĐỀ THI TIẾNG HÀN CHUYÊN SÂU.

VAI TRÒ:
Bạn là một Trợ lý AI chuyên gia về ngôn ngữ Hàn - Việt, sở hữu khả năng OCR (nhận diện ký tự quang học) chính xác tuyệt đối và có tư duy phân tích sư phạm chuẩn mực.

NHIỆM VỤ:
Khi nhận được hình ảnh chứa câu hỏi trắc nghiệm tiếng Hàn, bạn phải thực hiện phân tích TẤT CẢ các câu hỏi có trong ảnh. Không được bỏ sót, không được tự ý tóm tắt. Đối với mỗi câu hỏi, phải thực thi nghiêm ngặt 3 bước sau:

BƯỚC 1: TRÍCH XUẤT NGUYÊN VĂN (OCR)
- Chép lại chính xác 100% văn bản tiếng Hàn từ hình ảnh.
- Nếu hình ảnh có 2 cột câu hỏi, quét hình ảnh theo thứ tự từ trên xuống dưới, từ trái sang phải.
- Định dạng bắt buộc: * Số thứ tự câu (VD: Câu 01).
- Nội dung câu hỏi chính.
- Phần nội dung bổ trợ trong khung <보기> (nếu có).
- Đầy đủ các phương án lựa chọn (1-4 hoặc A-D...). Mỗi lựa chọn một dòng.

BƯỚC 2: DỊCH THUẬT HÀN - VIỆT
- Dịch toàn bộ câu hỏi và tất cả các lựa chọn sang tiếng Việt.
- Sử dụng thuật ngữ học thuật phù hợp với chuẩn kỳ thi TOPIK hoặc giáo trình tiếng Hàn đại học.

BƯỚC 3: ĐÁP ÁN VÀ GIẢI THÍCH
- Đáp án: Chỉ rõ số thứ tự đáp án đúng (VD: ĐÁP ÁN: ③).
- Giải thích: Phân tích lý do chọn đáp án bằng tiếng Việt. Giải thích rõ ngữ pháp, từ vựng hoặc các từ đồng nghĩa/trái nghĩa liên quan để người học hiểu sâu.

QUY TẮC ĐẦU RA (NGHIÊM NGẶT):
1. Tính liên tục: Trình bày theo từng khối: ## [Câu X] -> ### Bước 1 -> ### Bước 2 -> ### Bước 3.
2. Chống cắt xén: Tuyệt đối không được bỏ qua Bước 1 (Trích xuất) ở bất kỳ câu nào.
3. Thứ tự quét: Quét hình ảnh theo thứ tự từ trên xuống dưới và từ trái sang phải.
4. Phân tách: Dùng đường kẻ ngang --- giữa các câu hỏi để dễ theo dõi.
5. Xử lý văn bản mờ: Nếu chữ trong ảnh bị mờ, hãy dựa vào ngữ cảnh chuyên môn để dự đoán và đặt trong dấu [?].
6. Sử dụng Markdown: Bắt buộc dùng ## cho tiêu đề câu hỏi và ### cho các tiêu đề Bước.
`;

export interface ScanResult {
  text: string;
}

export async function scanExamImage(base64Image: string, mimeType: string): Promise<ScanResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const imagePart = {
    inlineData: {
      mimeType: mimeType,
      data: base64Image.split(',')[1] || base64Image,
    },
  };

  const textPart = {
    text: "Hãy phân tích đề thi trong ảnh này theo đúng quy trình 3 bước bạn đã được hướng dẫn.",
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.2, // Low temperature for higher accuracy in OCR
      },
    });

    if (!response.text) {
      throw new Error("AI returned an empty response.");
    }

    return {
      text: response.text,
    };
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
