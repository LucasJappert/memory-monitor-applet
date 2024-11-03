
function drawPieChart(ctx, x, y, radius, segments) {
    let startAngle = -Math.PI / 2; // Empezamos en la parte superior
    segments.forEach(segment => {
        const angle = startAngle + segment.value * 2 * Math.PI;

        // Dibujar segmento
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, radius, startAngle, angle);
        ctx.closePath();

        ctx.fillStyle = segment.color;
        ctx.fill();

        startAngle = angle;
    });
}

window.onload = function () {
    const canvas = document.getElementById("pieChartCanvas");
    const ctx = canvas.getContext("2d");

    // Datos de ejemplo
    const totalMemory = 16000;
    const usedMemory = 10000; // 10 GB
    const freeMemory = totalMemory - usedMemory;
    const braveMemory = 3200;
    const codeMemory = 4000;
    const otherMemory = usedMemory - braveMemory - codeMemory;
    const totalMemoryConsumedByProcesses = otherMemory + braveMemory + codeMemory;

    // Convertimos a porcentajes
    const usedPercent = usedMemory / totalMemory;
    const freePercent = freeMemory / totalMemory;
    const bravePercent = braveMemory / totalMemoryConsumedByProcesses;
    const codePercent = codeMemory / totalMemoryConsumedByProcesses;
    const otherPercent = otherMemory / totalMemoryConsumedByProcesses;

    // Primer gráfico de torta: memoria usada vs libre
    drawPieChart(ctx, 100, 100, 80, [
        { color: "rgba(255, 0, 0, 0.6)", value: usedPercent },   // Rojo para usada
        { color: "rgba(20, 225, 20, 1)", value: freePercent }    // Verde para libre
    ]);

    // Segundo gráfico de torta: desglose de la memoria usada
    drawPieChart(ctx, 300, 100, 80, [
        { color: "rgba(255, 153, 0, 0.8)", value: bravePercent }, // Naranja para Brave
        { color: "rgba(60, 60, 255, 1)", value: codePercent },   // Celeste para Code
        { color: "rgba(255, 255, 255, 0.2)", value: otherPercent }   // Amarillo para Otros
    ]);
};
