// Teachable Machine model URL
const CHEST_URL = "https://teachablemachine.withgoogle.com/models/CHMEJ5Ywr/";

let chestModel, chestMaxPredictions;

// load model
async function initChestModel() {
  const modelURL = CHEST_URL + "model.json";
  const metadataURL = CHEST_URL + "metadata.json";
  chestModel = await tmImage.load(modelURL, metadataURL);
  chestMaxPredictions = chestModel.getTotalClasses();
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
function generatePDFReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Set up PDF styling
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    let yPosition = margin;
    
    // Colors
    const primaryBlue = [41, 128, 185];
    const darkGray = [52, 73, 94];
    const lightGray = [149, 165, 166];
    const successGreen = [39, 174, 96];
    const warningRed = [231, 76, 60];
    
    // Header with logo area
    doc.setFillColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Main title
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('AI X-RAY ANALYSIS REPORT', pageWidth / 2, 20, { align: 'center' });
    
    // Subtitle
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Medical Image Analysis System', pageWidth / 2, 28, { align: 'center' });
    
    yPosition = 50;
    
    // Patient/File Information Box
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 30, 'F');
    doc.setDrawColor(200, 200, 200);
    doc.rect(margin, yPosition, pageWidth - 2 * margin, 30, 'S');
    
    yPosition += 10;
    
    // File information
    const fileName = document.getElementById("file-name-display")?.textContent || "Unknown File";
    const currentDate = new Date().toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    doc.text('File Name:', margin + 5, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(fileName, margin + 30, yPosition);
    
    yPosition += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Generated:', margin + 5, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(currentDate, margin + 30, yPosition);
    
    yPosition += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Report ID:', margin + 5, yPosition);
    doc.setFont('helvetica', 'normal');
    doc.text(`XRA-${Date.now().toString().slice(-6)}`, margin + 30, yPosition);
    
    yPosition += 25;
    
    // Analysis Results Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.text('ANALYSIS RESULTS', margin, yPosition);
    
    // Underline
    doc.setLineWidth(2);
    doc.setDrawColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
    doc.line(margin, yPosition + 3, margin + 60, yPosition + 3);
    
    yPosition += 20;
    
    // Get all result cards (excluding title card)
    const resultCards = document.querySelectorAll('.result-card');
    let analysisCount = 0;
    
    resultCards.forEach((card, index) => {
        // Skip the title card (first card)
        if (index === 0) return;
        
        analysisCount++;
        
        // Extract condition name
        const conditionHeader = card.querySelector('h3');
        const conditionName = conditionHeader ? conditionHeader.textContent : 'Unknown Condition';
        
        // Extract confidence score
        const confidenceText = card.textContent.match(/Confidence:\s*(\d+\.?\d*%)/);
        const confidence = confidenceText ? confidenceText[1] : 'N/A';
        const confidenceNum = parseFloat(confidence);
        
        // Extract analysis text
        const analysisDiv = card.querySelector(`[id^="detailed-analysis-"]`);
        let analysisText = '';
        if (analysisDiv) {
            analysisText = analysisDiv.textContent.trim();
            analysisText = analysisText.replace(/<[^>]*>/g, '');
        }
        
        // Check if we need a new page
        if (yPosition > pageHeight - 80) {
            doc.addPage();
            yPosition = margin;
        }
        
        // Condition box
        const boxHeight = 50;
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, yPosition, pageWidth - 2 * margin, boxHeight, 'F');
        doc.setDrawColor(220, 220, 220);
        doc.rect(margin, yPosition, pageWidth - 2 * margin, boxHeight, 'S');
        
        yPosition += 12;
        
        // Condition number and name
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(warningRed[0], warningRed[1], warningRed[2]);
        doc.text(`${analysisCount}. ${conditionName}`, margin + 5, yPosition);
        
        yPosition += 12;
        
        // Confidence score with color coding
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        doc.text('Confidence Level:', margin + 5, yPosition);
        
        // Color code confidence
        const confidenceColor = confidenceNum >= 80 ? successGreen : 
                               confidenceNum >= 60 ? [243, 156, 18] : warningRed;
        doc.setTextColor(confidenceColor[0], confidenceColor[1], confidenceColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(confidence, margin + 45, yPosition);
        
        // Confidence bar
        const barWidth = 60;
        const barHeight = 4;
        const barX = margin + 80;
        const barY = yPosition - 3;
        
        // Background bar
        doc.setFillColor(230, 230, 230);
        doc.rect(barX, barY, barWidth, barHeight, 'F');
        
        // Confidence bar fill
        doc.setFillColor(confidenceColor[0], confidenceColor[1], confidenceColor[2]);
        doc.rect(barX, barY, (barWidth * confidenceNum) / 100, barHeight, 'F');
        
        yPosition += 15;
        
        // Risk level indicator
        const riskLevel = confidenceNum >= 80 ? 'HIGH' : confidenceNum >= 60 ? 'MEDIUM' : 'LOW';
        const riskColor = confidenceNum >= 80 ? warningRed : confidenceNum >= 60 ? [243, 156, 18] : successGreen;
        
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
        doc.text('Risk Level:', margin + 5, yPosition);
        doc.setTextColor(riskColor[0], riskColor[1], riskColor[2]);
        doc.text(riskLevel, margin + 30, yPosition);
        
        yPosition += 25;
        
        // Analysis details header
        if (analysisText) {
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
            doc.text('Detailed Medical Analysis', margin, yPosition);
            yPosition += 15;
            
            // Analysis content box
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
            
            // Parse analysis sections
            const sections = analysisText.split(/(?=Symptoms:|Diagnostic Tests:|Treatment Options:|Seek immediate)/);
            
            sections.forEach(section => {
                if (!section.trim()) return;
                
                // Check for page break
                if (yPosition > pageHeight - 40) {
                    doc.addPage();
                    yPosition = margin;
                }
                
                // Section header
                const headerMatch = section.match(/^(Symptoms|Diagnostic Tests|Treatment Options|Seek immediate):/);
                if (headerMatch) {
                    doc.setFont('helvetica', 'bold');
                    doc.setFontSize(11);
                    doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
                    doc.text(headerMatch[1] + ':', margin + 5, yPosition);
                    yPosition += 8;
                    
                    // Content
                    const content = section.replace(/^[^:]*:/, '').trim();
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(10);
                    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
                    
                    const maxWidth = pageWidth - 2 * margin - 10;
                    const lines = doc.splitTextToSize(content, maxWidth);
                    
                    lines.forEach(line => {
                        if (yPosition > pageHeight - 25) {
                            doc.addPage();
                            yPosition = margin;
                        }
                        doc.text(line, margin + 10, yPosition);
                        yPosition += 5;
                    });
                    yPosition += 5;
                } else {
                    // Regular content
                    const maxWidth = pageWidth - 2 * margin - 10;
                    const lines = doc.splitTextToSize(section.trim(), maxWidth);
                    
                    lines.forEach(line => {
                        if (yPosition > pageHeight - 25) {
                            doc.addPage();
                            yPosition = margin;
                        }
                        doc.text(line, margin + 10, yPosition);
                        yPosition += 5;
                    });
                }
                yPosition += 5;
            });
        }
        
        yPosition += 15;
    });
    
    // Footer
    const footerY = pageHeight - 30;
    
    // Footer background
    doc.setFillColor(240, 240, 240);
    doc.rect(0, footerY - 5, pageWidth, 35, 'F');
    
    // Disclaimer
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(warningRed[0], warningRed[1], warningRed[2]);
    doc.text('⚠️ MEDICAL DISCLAIMER', pageWidth / 2, footerY + 5, { align: 'center' });
    
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(darkGray[0], darkGray[1], darkGray[2]);
    const disclaimerText = 'This is an AI-generated analysis for screening purposes only. Results should not be used for final medical diagnosis. Please consult a qualified medical professional for proper evaluation and treatment.';
    const disclaimerLines = doc.splitTextToSize(disclaimerText, pageWidth - 2 * margin);
    
    let disclaimerY = footerY + 12;
    disclaimerLines.forEach(line => {
        doc.text(line, pageWidth / 2, disclaimerY, { align: 'center' });
        disclaimerY += 4;
    });
    
    // Save the PDF
    const reportFileName = `X-Ray_Analysis_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(reportFileName);
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

  // Create button container
  const buttonContainer = document.createElement("div");
  buttonContainer.style.marginTop = "1rem";
  buttonContainer.style.display = "flex";
  buttonContainer.style.gap = "10px";
  buttonContainer.style.justifyContent = "center";

  // Download Report button
  const downloadBtn = document.createElement("button");
  downloadBtn.className = "btn btn-success";
  downloadBtn.innerText = "Download Report";
  downloadBtn.style.backgroundColor = "#28a745";
  downloadBtn.style.color = "white";
  downloadBtn.style.border = "none";
  downloadBtn.style.padding = "10px 20px";
  downloadBtn.style.borderRadius = "5px";
  downloadBtn.style.cursor = "pointer";
  downloadBtn.addEventListener("click", generatePDFReport);

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-primary";
  closeBtn.innerText = "Close";
  closeBtn.style.backgroundColor = "#007bff";
  closeBtn.style.color = "white";
  closeBtn.style.border = "none";
  closeBtn.style.padding = "10px 20px";
  closeBtn.style.borderRadius = "5px";
  closeBtn.style.cursor = "pointer";
  closeBtn.addEventListener("click", () => {
    document.getElementById("upload-section").style.display = "none";
  });

  // Add buttons to container
  buttonContainer.appendChild(downloadBtn);
  buttonContainer.appendChild(closeBtn);
  analysisResults.appendChild(buttonContainer);

  analysisResults.style.display = "block";
}
