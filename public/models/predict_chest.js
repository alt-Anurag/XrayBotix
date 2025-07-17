// Teachable Machine model URL
const CHEST_URL = "https://teachablemachine.withgoogle.com/models/CHMEJ5Ywr/";

let chestModel, chestMaxPredictions;

// load model
async function initChestModel() {
  const modelURL = CHEST_URL + "model.json";
  const metadataURL = CHEST_URL + "metadata.json";
  chestModel = await tmImage.load(modelURL, metadataURL);
  chestMaxPredictions = model.getTotalClasses();
}

// advanced grayscale + brightness + contrast filter
function isLikelyXray(imageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = imageElement.width;
  canvas.height = imageElement.height;

  if (canvas.width < 128 || canvas.height < 128) {
    return false; // Reject very small images
  }

  const ctx = canvas.getContext("2d");
  ctx.drawImage(imageElement, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let grayscalePixels = 0;
  let totalLuminance = 0;
  let luminanceValues = [];
  const totalPixels = canvas.width * canvas.height;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];

    const isGray =
      Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(r - b) < 10;
    if (isGray) grayscalePixels++;

    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    totalLuminance += luminance;
    luminanceValues.push(luminance);
  }

  const grayscaleRatio = grayscalePixels / totalPixels;
  const avgLuminance = totalLuminance / totalPixels;

  // contrast, standard deviation of luminance
  const mean = avgLuminance;
  const variance =
    luminanceValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    totalPixels;
  const contrast = Math.sqrt(variance);

  console.log(
    "📊 grayscale:",
    grayscaleRatio.toFixed(2),
    "brightness:",
    avgLuminance.toFixed(2),
    "contrast:",
    contrast.toFixed(2)
  );

  const isGrayscaleEnough = grayscaleRatio >= 0.88;
  const isBrightnessOK = avgLuminance >= 50 && avgLuminance <= 190;
  const isContrastOK = contrast >= 25;

  return isGrayscaleEnough && isBrightnessOK && isContrastOK;
}

async function generateMedicalAnalysis(condition) {
  try {
    const response = await fetch("/.netlify/functions/analysis-generator", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ condition }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate medical analysis");
    }

    const data = await response.json();
    return data.analysis;
  } catch (error) {
    console.error("Error generating analysis:", error);
    return null;
  }
}

// predictions from uploaded image
async function predictChestFromUpload(imageElement) {
  const analysisResults = document.getElementById("analysis-results");
  const loadingSpinner = document.getElementById("loading-spinner");
  const previewBox = document.getElementById("preview-box");

  analysisResults.innerHTML = "";
  analysisResults.style.display = "none";

  // block invalid images before prediction
  if (!isLikelyXray(imageElement)) {
    const message = document.createElement("div");
    message.className = "result-card";
    message.innerHTML = `
      <h3 style="color: #f97316;">⚠️ Invalid Image</h3>
      <p>This image does not appear to be a chest X-ray. Please upload a proper grayscale X-ray image.</p>
      <button class="btn btn-primary" style="margin-top: 1rem;" onclick="document.getElementById('upload-section').style.display = 'none';">Try Again</button>
    `;
    analysisResults.appendChild(message);
    previewBox.style.display = "none";
    analysisResults.style.display = "block";
    return;
  }

  previewBox.style.display = "none";
  loadingSpinner.style.display = "block";
  analysisResults.style.display = "none";

  await new Promise((resolve) => setTimeout(resolve, 3000));
  if (!chestModel) await initChestModel();
  const predictions = await chestModel.predict(imageElement);

  analysisResults.innerHTML = "";
  loadingSpinner.style.display = "none";
  analysisResults.style.display = "block"; // only show once ready

  const fileName =
    document.getElementById("file-name-display")?.textContent || "";

  const titleCard = document.createElement("div");
  titleCard.className = "result-card";
  titleCard.innerHTML = `
    <h3 style="color: var(--accent-color);">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      Analysis Complete
    </h3>
    <p id="result-file-name">${fileName}</p>
  `;
  analysisResults.appendChild(titleCard);

  const sorted = predictions.sort((a, b) => b.probability - a.probability);
  let topToShow = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    if (
      sorted[i].probability * 100 >= 60 ||
      sorted[i].probability >= sorted[0].probability - 0.1
    ) {
      topToShow.push(sorted[i]);
    } else break;
  }

  topToShow = topToShow.filter((pred) => pred.probability > 0.05);

  // Function to generate medical analysis from Gemini API
  const generateMedicalAnalysis = async (condition) => {
    try {
      const response = await fetch("/.netlify/functions/analysis-generator", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ condition }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate medical analysis");
      }

      const data = await response.json();
      return data.analysis;
    } catch (error) {
      console.error("Error generating analysis:", error);
      return null;
    }
  };

  // Process each prediction and generate analysis
  for (const pred of topToShow) {
    const resultCard = document.createElement("div");
    resultCard.className = "result-card";

    // Initial result card with loading state
    resultCard.innerHTML = `
      <h3>Predicted Condition</h3>
      <p style="color: #58a6ff; font-weight: 600;">${pred.className}</p>
      <p>Confidence: ${(pred.probability * 100).toFixed(2)}%</p>
      <div id="analysis-loading-${pred.className.replace(
        /\s+/g,
        "-"
      )}" class="loading-spinner-small">
  <i class="fas fa-spinner fa-spin" style="font-size: 18px;"></i>
  <p>Generating detailed analysis...</p>
</div>

      <div id="detailed-analysis-${pred.className.replace(
        /\s+/g,
        "-"
      )}" style="display: none;"></div>
      <p class="result-note">Note: This is an AI prediction. Consult a medical professional for actual diagnosis.</p>
    `;

    analysisResults.appendChild(resultCard);

    // Generate and display detailed analysis
    const analysis = await generateMedicalAnalysis(pred.className);
    const loadingElement = document.getElementById(
      `analysis-loading-${pred.className.replace(/\s+/g, "-")}`
    );
    const analysisElement = document.getElementById(
      `detailed-analysis-${pred.className.replace(/\s+/g, "-")}`
    );

    if (analysis) {
      loadingElement.style.display = "none";
      analysisElement.innerHTML = `
        <h3 style="margin-top: 1rem;">Detailed Medical Analysis</h3>
        <div style="margin-top: 0.5rem; line-height: 1.6;">${analysis.replace(
          /\n/g,
          "<br>"
        )}</div>
      `;
      analysisElement.style.display = "block";
    } else {
      loadingElement.innerHTML =
        '<p style="color: #f97316;">Could not generate detailed analysis. Please consult a doctor for more information.</p>';
    }
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-primary";
  closeBtn.style.marginTop = "1rem";
  closeBtn.id = "close-results-btn";
  closeBtn.innerText = "Close";
  closeBtn.addEventListener("click", () => {
    document.getElementById("upload-section").style.display = "none";
  });

  analysisResults.appendChild(closeBtn);
  analysisResults.style.display = "block";
}
