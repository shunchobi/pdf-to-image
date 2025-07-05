<template>
  <div class="app">
    <h1>PDF to Image Converter</h1>

    <div class="upload-section">
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

// PDF.jsを動的にロードする
let pdfjsLib: any = null;

onMounted(async () => {
  try {
    // CDNからPDF.jsスクリプトを動的に読み込み
    const script = document.createElement("script");
    script.src = "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js";
    script.onload = () => {
      // @ts-ignore
      pdfjsLib = window.pdfjsLib;
      // @ts-ignore
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
      console.log("PDF.js loaded successfully");
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
