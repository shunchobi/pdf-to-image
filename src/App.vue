<template>
  <div class="app">
    <h1>PDF to Image Converter</h1>

    <div class="upload-section">
      <div class="upload-option">
        <h3>ファイルから選択</h3>
        <input
          type="file"
          accept=".pdf"
          @change="handleFileChange"
          ref="fileInput"
          id="file-input"
          class="file-input"
        />
        <label for="file-input" class="file-label"> PDFファイルを選択 </label>
      </div>

      <div class="divider">または</div>

      <div class="upload-option">
        <h3>URLから読み込み</h3>
        <div class="url-input-section">
          <input
            type="url"
            v-model="pdfUrl"
            placeholder="PDFのURLを入力してください"
            class="url-input"
          />
          <button
            @click="handleUrlLoad"
            class="url-button"
            :disabled="!pdfUrl || loading"
          >
            URLから変換
          </button>
        </div>
        <div class="url-note">
          <small>
            ※
            一部のサイトはCORSポリシーによりアクセスできない場合があります。<br />
            直接ダウンロード可能なPDFのURLを使用してください。
          </small>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">変換中...</div>

    <div v-if="error" class="error">
      {{ error }}
    </div>

    <div v-if="images.length > 0" class="images-container">
      <h2>変換された画像 ({{ images.length }}ページ)</h2>
      <div class="images-grid">
        <div v-for="(image, index) in images" :key="index" class="image-item">
          <h3>ページ {{ index + 1 }}</h3>
          <img :src="image" :alt="`Page ${index + 1}`" class="pdf-image" />
          <a
            :href="image"
            :download="`page-${index + 1}.png`"
            class="download-btn"
          >
            ダウンロード
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const fileInput = ref<HTMLInputElement>();
const images = ref<string[]>([]);
const loading = ref(false);
const error = ref("");
const pdfUrl = ref(
  "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf"
);

// PDF.jsを動的にロードする
let pdfjsLib: any = null;

onMounted(async () => {
  try {
    // ローカルのPDF.jsスクリプトを読み込み
    const script = document.createElement("script");
    script.src = "/pdf.min.js";
    script.onload = () => {
      // @ts-ignore
      pdfjsLib = window.pdfjsLib;
      // @ts-ignore
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
      console.log("PDF.js loaded successfully from local file");
    };
    script.onerror = () => {
      error.value = "PDF.jsの読み込みに失敗しました";
    };
    document.head.appendChild(script);
  } catch (err) {
    console.error("PDF.jsの読み込みエラー:", err);
    error.value = "PDF.jsの読み込みに失敗しました";
  }
});

const handleFileChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  if (file.type !== "application/pdf") {
    error.value = "PDFファイルを選択してください";
    return;
  }

  await convertPdfToImages(file);
};

const handleUrlLoad = async () => {
  if (!pdfUrl.value) {
    error.value = "PDFのURLを入力してください";
    return;
  }

  if (!pdfjsLib) {
    error.value =
      "PDF.jsがまだ読み込まれていません。しばらく待ってから再試行してください。";
    return;
  }

  loading.value = true;
  error.value = "";
  images.value = [];

  // 複数のCORSプロキシを試す
  const corsProxies = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(pdfUrl.value)}`,
    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(
      pdfUrl.value
    )}`,
    pdfUrl.value, // 直接アクセスも試す
  ];

  for (let i = 0; i < corsProxies.length; i++) {
    try {
      console.log(
        `Trying proxy ${i + 1}/${corsProxies.length}: ${corsProxies[i]}`
      );

      const response = await fetch(corsProxies[i]);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();

      // ArrayBufferが空でないことを確認
      if (arrayBuffer.byteLength === 0) {
        throw new Error("取得したファイルが空です");
      }

      // PDFの署名を確認（PDFファイルは%PDFで始まる）
      const firstBytes = new Uint8Array(arrayBuffer.slice(0, 4));
      const signature = String.fromCharCode(...firstBytes);
      if (!signature.startsWith("%PDF")) {
        throw new Error("取得したファイルはPDFではありません");
      }

      await convertPdfFromArrayBuffer(arrayBuffer);
      return; // 成功した場合は関数を終了
    } catch (err) {
      console.error(`Proxy ${i + 1} failed:`, err);

      // 最後のプロキシも失敗した場合
      if (i === corsProxies.length - 1) {
        error.value = `PDFの取得中にエラーが発生しました。

原因の可能性:
1. URLが正しくない
2. PDFファイルが存在しない  
3. サーバーがCORSを許可していない
4. プロキシサービスが利用できない

以下を確認してください:
• URLが正しく、PDFファイルが存在することを確認
• ブラウザでURLに直接アクセスしてPDFが表示されることを確認
• 可能であれば、CORSヘッダーを設定したサーバーのPDFを使用`;
        loading.value = false;
      }
    }
  }
};

const convertPdfToImages = async (file: File) => {
  if (!pdfjsLib) {
    error.value =
      "PDF.jsがまだ読み込まれていません。しばらく待ってから再試行してください。";
    return;
  }

  loading.value = true;
  error.value = "";
  images.value = [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    await convertPdfFromArrayBuffer(arrayBuffer);
  } catch (err) {
    console.error("PDF変換エラー:", err);
    error.value = "PDFの変換中にエラーが発生しました";
    loading.value = false;
  }
};

const convertPdfFromArrayBuffer = async (arrayBuffer: ArrayBuffer) => {
  try {
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    const totalPages = pdf.numPages;

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Canvas context could not be created");
      }

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      const imageDataUrl = canvas.toDataURL("image/png");
      images.value.push(imageDataUrl);
    }
  } catch (err) {
    console.error("PDF変換エラー:", err);
    error.value = "PDFの変換中にエラーが発生しました";
    throw err;
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
}

h1 {
  text-align: center;
  color: #333;
  margin-bottom: 30px;
}

.upload-section {
  text-align: center;
  margin-bottom: 30px;
}

.upload-option {
  margin-bottom: 20px;
  padding: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.upload-option h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 18px;
}

.divider {
  margin: 20px 0;
  font-size: 16px;
  color: #666;
  font-weight: bold;
}

.url-input-section {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

.url-input {
  flex: 1;
  min-width: 300px;
  padding: 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 14px;
}

.url-input:focus {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.url-button {
  padding: 12px 24px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

.url-button:hover:not(:disabled) {
  background-color: #218838;
}

.url-button:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

.url-note {
  margin-top: 10px;
  color: #666;
  font-style: italic;
}

.url-note small {
  font-size: 12px;
}

.file-input {
  display: none;
}

.file-label {
  display: inline-block;
  padding: 12px 24px;
  background-color: #007bff;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s;
  font-size: 16px;
}

.file-label:hover {
  background-color: #0056b3;
}

.loading {
  text-align: center;
  font-size: 18px;
  color: #007bff;
  margin: 20px 0;
}

.error {
  text-align: center;
  color: #dc3545;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 4px;
  padding: 12px;
  margin: 20px 0;
}

.images-container {
  margin-top: 30px;
}

.images-container h2 {
  color: #333;
  margin-bottom: 20px;
}

.images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
}

.image-item {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  text-align: center;
  background-color: #f9f9f9;
}

.image-item h3 {
  margin: 0 0 10px 0;
  color: #555;
}

.pdf-image {
  max-width: 100%;
  height: auto;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.download-btn {
  display: inline-block;
  margin-top: 10px;
  padding: 8px 16px;
  background-color: #28a745;
  color: white;
  text-decoration: none;
  border-radius: 4px;
  transition: background-color 0.3s;
}

.download-btn:hover {
  background-color: #218838;
}
</style>
