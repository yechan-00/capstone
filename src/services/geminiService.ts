import { CategoryKey } from "@/lib/expenseOptions";
import { ExpenseMood } from "@/lib/types";

const GEMINI_MODEL_PATH =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function getGeminiRequestUrl(): string {
  const key = process.env.EXPO_PUBLIC_GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "Gemini API 키가 없습니다. 프로젝트 루트에 .env 파일을 만들고 EXPO_PUBLIC_GEMINI_API_KEY=… 를 설정한 뒤 Metro(개발 서버)를 다시 시작하세요.",
    );
  }
  return `${GEMINI_MODEL_PATH}?key=${encodeURIComponent(key)}`;
}

export interface ScanResult {
  amount?: number;
  category?: CategoryKey;
  content?: string; // 메뉴 1개일 때 메뉴명, 2개 이상일 때 첫 메뉴명
  memo?: string; // 가게명 + 메뉴 2개 이상일 때 목록
  spentAt?: Date;
  tags?: string[];
  mood?: ExpenseMood;
}

export async function scanReceiptImage(
  base64Image: string,
  mimeType: string = "image/jpeg",
): Promise<ScanResult> {
  const prompt = `Respond with ONLY raw JSON, no markdown, no backticks, no explanation.

Extract from this receipt/payment image:
{"amount":총결제금액,"category":"delivery"|"cafe"|"takeout","store":"가게명 or null","items":[{"name":"메뉴명","price":가격}],"discounts":[{"name":"할인명","amount":할인금액}],"date":"YYYY-MM-DDTHH:mm:ss or null"}

Rules:
- amount: final total payment amount
- category: delivery=배달앱(baemin/coupang/yogiyo), cafe=카페/음료, takeout=포장·매장에서 포장·직접 방문(비배달)
- store: restaurant/store name, null if not found
- items: all ordered menu items with price (exclude delivery fee)
- discounts: discount items with amount (positive number), empty array if none
- date: exact date and time from receipt

One line JSON only:`;

  const response = await fetch(getGeminiRequestUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: base64Image } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: 400 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API 오류: ${err}`);
  }

  const data = await response.json();
  const raw: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  const cleaned = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .replace(/`/g, "")
    .trim();

  const result: ScanResult = {};

  // amount
  const amountMatch = cleaned.match(/"amount"\s*:\s*(\d+)/);
  if (amountMatch) result.amount = parseInt(amountMatch[1], 10);

  // category
  const categoryMatch = cleaned.match(
    /"category"\s*:\s*"(takeout|food|cafe|delivery)"/,
  );
  if (categoryMatch) {
    const raw = categoryMatch[1];
    result.category = (raw === 'food' ? 'takeout' : raw) as CategoryKey;
  }

  // date
  const dateMatch = cleaned.match(/"date"\s*:\s*"([^"]+)"/);
  if (dateMatch) {
    const d = new Date(dateMatch[1]);
    if (!isNaN(d.getTime())) result.spentAt = d;
  }

  // store
  const storeMatch = cleaned.match(/"store"\s*:\s*"([^"]+)"/);
  const store = storeMatch ? storeMatch[1] : null;

  // items 파싱
  const itemsMatch = cleaned.match(/"items"\s*:\s*\[([^\]]*)\]/);
  let items: { name: string; price: number }[] = [];
  if (itemsMatch) {
    const itemsStr = itemsMatch[1];
    const itemRegex = /\{"name"\s*:\s*"([^"]+)"\s*,\s*"price"\s*:\s*(\d+)\}/g;
    let m;
    while ((m = itemRegex.exec(itemsStr)) !== null) {
      items.push({ name: m[1], price: parseInt(m[2], 10) });
    }
  }

  // discounts 파싱
  const discountsMatch = cleaned.match(/"discounts"\s*:\s*\[([^\]]*)\]/);
  let discounts: { name: string; amount: number }[] = [];
  if (discountsMatch) {
    const discStr = discountsMatch[1];
    const discRegex = /\{"name"\s*:\s*"([^"]+)"\s*,\s*"amount"\s*:\s*(\d+)\}/g;
    let m;
    while ((m = discRegex.exec(discStr)) !== null) {
      discounts.push({ name: m[1], amount: parseInt(m[2], 10) });
    }
  }

  // [내용]: 메뉴 이름 전부 (쉼표 구분)
  if (items.length > 0) {
    result.content = items.map((i) => i.name).join(", ");
  } else if (store) {
    result.content = store;
  }

  // [메모]: 가게명 + 메뉴별 가격 + 할인 내역
  const memoLines: string[] = [];
  if (store) memoLines.push(`📍 ${store}`);
  if (items.length > 0) {
    items.forEach((i) =>
      memoLines.push(`· ${i.name} ${i.price.toLocaleString()}원`),
    );
  }
  if (discounts.length > 0) {
    discounts.forEach((d) =>
      memoLines.push(`· ${d.name} -${d.amount.toLocaleString()}원`),
    );
  }
  if (memoLines.length > 0) result.memo = memoLines.join("\n");

  return result;
}
