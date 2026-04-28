const canvas = document.querySelector("#signalCanvas");
const ctx = canvas.getContext("2d");
const riskScore = document.querySelector("#riskScore");
const assistantText = document.querySelector("#assistantText");
const reportButton = document.querySelector("#generateReport");

let phase = 0;

function drawSignal() {
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);

  const gridColor = "rgba(88, 232, 224, 0.14)";
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += 38) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += 38) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  const gradients = [
    ["rgba(39, 225, 213, 0.95)", 64, 0.9],
    ["rgba(120, 255, 207, 0.8)", 104, 0.7],
    ["rgba(45, 140, 255, 0.68)", 145, 0.54],
  ];

  gradients.forEach(([color, offset, amp], index) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = index === 0 ? 3 : 2;

    for (let x = 0; x < width; x += 6) {
      const y =
        height * 0.58 +
        Math.sin((x + phase * (1.5 + index)) / offset) * 46 * amp +
        Math.cos((x - phase * 1.2) / (offset * 0.42)) * 18;

      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  });

  for (let i = 0; i < 22; i += 1) {
    const x = (i * 73 + phase * 1.8) % width;
    const y = height * 0.52 + Math.sin((i + phase / 18) * 1.7) * 112;
    const radius = 2 + ((i + Math.floor(phase / 10)) % 3);

    ctx.beginPath();
    ctx.fillStyle = i % 5 === 0 ? "rgba(255, 99, 125, 0.86)" : "rgba(120, 255, 207, 0.82)";
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  phase += 1;
  requestAnimationFrame(drawSignal);
}

function rotateRisk() {
  const base = 68 + Math.round(Math.sin(Date.now() / 1800) * 6);
  riskScore.textContent = String(base);
}

reportButton.addEventListener("click", () => {
  assistantText.textContent =
    "Relatorio executivo preparado: 9 alertas consolidados, 3 prioridades criticas, 4 fontes verificadas e recomendacao de revisao fiscal imediata antes da aprovacao final.";
});

setInterval(rotateRisk, 1400);
drawSignal();
