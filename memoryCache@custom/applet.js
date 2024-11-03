const Applet = imports.ui.applet;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Cairo = imports.cairo;
const ByteArray = imports.byteArray;


// Función para obtener el total de memoria usada por procesos que contienen un nombre específico
const GetMemoryUsageByPattern = (pattern, excludePattern) => {
    // Escapa el patrón si contiene barras '/' o caracteres especiales
    const escapedPattern = pattern.replace(/([\/"'\\])/g, "\\$1");
    const escapedExcludePattern = excludePattern ? excludePattern.replace(/([\/"'\\])/g, "\\$1") : null;

    // Construye el comando, usando el patrón como parámetro
    const cmdExclude = escapedExcludePattern ? `| grep -v "${escapedExcludePattern}" ` : "";
    // let command = `sh -c 'ps aux | grep "${escapedPattern}" ${cmdExclude}| grep -v grep | awk "{print \\$6}"'`;
    let command = `sh -c 'ps aux | grep "${escapedPattern}" ${cmdExclude} | awk "{print \\$6}"'`;

    let [success, stdout, stderr] = GLib.spawn_command_line_sync(command);

    if (!success) {
        print(`Error al ejecutar el comando: ${ByteArray.toString(stderr)}`);
        return 0;
    }

    // Convertimos la salida a string y dividimos por líneas
    let memoryValues = ByteArray.toString(stdout).trim().split("\n");

    // Convertimos cada línea a un número y sumamos la memoria total en KB
    let totalMemoryKB = memoryValues.reduce((acc, value) => acc + parseInt(value, 10), 0);

    // Convertimos de KB a MB
    let totalMemoryMB = totalMemoryKB / 1024;
    let totalMemoryMBRounded = Math.round(totalMemoryMB * 100) / 100;

    return totalMemoryMBRounded;
};

const UpdateMemoryInfo = () => {

    // Obtenemos info de la memoria general del sistema
    const [res, stdout] = GLib.spawn_command_line_sync("free -m");
    if (!(res && stdout)) return;

    const lines = stdout.toString().split("\n");
    const memLine = lines[1].split(/\s+/);
    const totalMemory = parseInt(memLine[1]);
    MEMORY_DATA.usedMemory.UpdateValue(parseInt(memLine[2]), totalMemory); // Memoria usada en MB
    MEMORY_DATA.freeMemory.UpdateValue(parseInt(memLine[3]), totalMemory); // Memoria libre en MB
    MEMORY_DATA.buffCacheMemory.UpdateValue(parseInt(memLine[5]), totalMemory); // Memoria de buffer cache en MB

    // Obtenemos info de la memoria de los procesos
    for (const customProcess of MEMORY_DATA.customProcessesMemory) {
        customProcess.UpdateValue(MEMORY_DATA.totalUsedMemory());
    }
    MEMORY_DATA.customProcessesMemory.sort((a, b) => b.valueInMb - a.valueInMb);

    const otherProcessesMemory = MEMORY_DATA.totalUsedMemory() - MEMORY_DATA.customProcessesMemory.reduce((acc, process) => acc + process.valueInMb, 0);
    MEMORY_DATA.otherProcessesMemory.UpdateValue(otherProcessesMemory, MEMORY_DATA.totalUsedMemory());
}

class MemoryData {
    label = "";
    valueInMb = 0;
    percent = 0;
    color = [1, 1, 1, 1];

    /**
     * @param {String} label 
     * @param {number} valueInMb 
     * @param {number} totalMemoryInMb 
     * @param {Array<number>} color
     */
    constructor(label, valueInMb, totalMemoryInMb, color) {
        this.label = label;
        if (color) this.color = color;
        this.UpdateValue(valueInMb, totalMemoryInMb);
    }

    UpdateValue = (valueInMb, totalMemoryInMb) => {
        this.valueInMb = valueInMb;

        if (totalMemoryInMb <= 0) this.percent = 0;
        else this.percent = Math.round((valueInMb / totalMemoryInMb) * 100);
    }
}
class CustomProcessData extends MemoryData {
    processPattern = "";
    excludePattern = "";

    /**
     * @param {String} label 
     * @param {number} valueInMb 
     * @param {number} totalMemoryInMb 
     * @param {Array<number>} color
     * @param {String} processPattern
     * @param {String} excludePattern
     */
    constructor(label, valueInMb, totalMemoryInMb, color, processPattern, excludePattern = "") {
        super(label, valueInMb, totalMemoryInMb, color);
        this.processPattern = processPattern;
        this.excludePattern = excludePattern;
    }

    UpdateValue = (totalMemoryInMb) => {
        this.valueInMb = GetMemoryUsageByPattern(this.processPattern, this.excludePattern);
        this.percent = Math.round((this.valueInMb / totalMemoryInMb) * 100);
    }
}

const MEMORY_DATA = {
    freeMemory: new MemoryData("Free", 0, 0, [0.1, 1, 0.1, 1]),
    buffCacheMemory: new MemoryData("Buffer Cache", 0, 0, [0.8784, 0.6235, 0.2431, 1.0]),
    usedMemory: new MemoryData("Used", 0, 0, [0.9196, 0.1647, 0.1686, 1.0]),
    customProcessesMemory: [
        new CustomProcessData("Brave", 0, 0, [0.7333, 0.2431, 0.0118, 1.0], "brave"),
        new CustomProcessData("Code", 0, 0, [0.0078, 0.2431, 0.5412, 1.0], "code", ".vscode/extensions"),
        new CustomProcessData("Code Extensions", 0, 0, [0.0, 0.4667, 0.7137, 1.0], ".vscode/extensions"),
    ],
    otherProcessesMemory: new MemoryData("Other Processes", 0, 0, [1, 1, 1, 0.5]),
    totalUsedMemory: () => MEMORY_DATA.usedMemory.valueInMb + MEMORY_DATA.buffCacheMemory.valueInMb,
};

//TODO: Destroy applet when its removed
class MyApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        this._applet_tooltip._tooltip.set_style('font-family: monospace;');

        // Inicializamos el área de dibujo con el alto de la barra de tareas
        this.drawingArea = new imports.gi.St.DrawingArea();
        this.drawingArea.connect("repaint", this._onRepaint.bind(this));
        this.drawingArea.set_size(panel_height * 2 + 4, panel_height);  // Tamaño para ocupar el alto de la barra
        this.actor.add_actor(this.drawingArea);

        // Variable para almacenar el ID del timer
        this._refreshTimer = null;

        // Actualizamos los datos periódicamente
        this._refreshData();
    }

    _refreshData() {
        // Guardamos los datos para usarlos en el repaint y en el tooltip
        UpdateMemoryInfo();

        this.drawingArea.queue_repaint();

        // Actualizamos el tooltip con los datos más recientes
        this._updateTooltip();

        // Programamos la siguiente actualización
        Mainloop.timeout_add(1000, this._refreshData.bind(this));
    }

    _updateTooltip() {
        if (MEMORY_DATA.totalUsedMemory().valueInMb <= 0) return;

        const charsLength = 40;

        // Función auxiliar para asegurarnos de que todos los valores sean números válidos
        function ensureNumber(value, defaultValue = 0) {
            return typeof value === "number" && !isNaN(value) ? value : defaultValue;
        }
        // Función auxiliar para formatear cada línea de memoria a un ancho de 100 caracteres
        function formatLine(label, valueMB, percent) {
            valueMB = ensureNumber(valueMB);
            percent = ensureNumber(percent);


            const fixedLabel = label.padEnd(18, ' ');
            const fixedValue = valueMB.toFixed(2).padStart(7, ' ');
            const fixedPercent = percent.toFixed(1).padStart(5, ' ');
            const line = `${fixedLabel}: ${fixedValue} MB (${fixedPercent} %)`;
            return line;
        }
        // Función auxiliar para formatear el título con guiones ajustados a charsLength
        function formatTitle(title) {
            const titleLength = title.length;
            const dashLength = Math.floor((charsLength - titleLength) / 2);
            const dashes = '-'.repeat(dashLength);

            // Si el total de caracteres no es par, agrega un guion adicional al final
            return `${dashes} ${title} ${dashes}`.padEnd(charsLength, '-');
        }

        // Construimos el texto para el tooltip usando las funciones auxiliares
        let tooltipText = "";
        tooltipText += formatTitle("GENERAL MEMORY STATISTICS") + "\n";
        tooltipText += formatLine(MEMORY_DATA.freeMemory.label, MEMORY_DATA.freeMemory.valueInMb, MEMORY_DATA.freeMemory.percent) + "\n";
        tooltipText += formatLine(MEMORY_DATA.usedMemory.label, MEMORY_DATA.usedMemory.valueInMb, MEMORY_DATA.usedMemory.percent) + "\n";
        tooltipText += formatLine(MEMORY_DATA.buffCacheMemory.label, MEMORY_DATA.buffCacheMemory.valueInMb, MEMORY_DATA.buffCacheMemory.percent) + "\n";
        tooltipText += formatTitle("CONSUMED MEMORY BY PROCESSES") + "\n";
        for (const customProcess of MEMORY_DATA.customProcessesMemory) {
            tooltipText += formatLine(customProcess.label, customProcess.valueInMb, customProcess.percent) + "\n";
        }
        const { label, valueInMb, percent } = MEMORY_DATA.otherProcessesMemory;
        tooltipText += formatLine(label, valueInMb, percent) + "\n";
        tooltipText += '-'.repeat(charsLength);

        this.set_applet_tooltip(tooltipText);
    }

    _onRepaint(area) {
        if (MEMORY_DATA.totalUsedMemory() <= 0) return;

        const ctx = area.get_context();

        // Limpiamos el contexto para evitar superposiciones
        ctx.save();
        ctx.setOperator(Cairo.Operator.CLEAR);
        ctx.paint();
        ctx.restore();

        // Ajustamos el radio para que el gráfico ocupe el alto de la barra de tareas
        const radius = Math.floor(area.height / 2) - 2;

        this._drawPieChart(ctx, radius + 2, radius + 2, radius, [
            { color: MEMORY_DATA.usedMemory.color, value: MEMORY_DATA.usedMemory.percent / 100 },
            { color: MEMORY_DATA.freeMemory.color, value: MEMORY_DATA.freeMemory.percent / 100 },
            { color: MEMORY_DATA.buffCacheMemory.color, value: MEMORY_DATA.buffCacheMemory.percent / 100 }
        ]);

        const piecesOfChart = [];
        for (const customProcess of MEMORY_DATA.customProcessesMemory) {
            piecesOfChart.push({ color: customProcess.color, value: customProcess.percent / 100 });
        }
        piecesOfChart.push({ color: MEMORY_DATA.otherProcessesMemory.color, value: MEMORY_DATA.otherProcessesMemory.percent / 100 });
        this._drawPieChart(ctx, area.width - radius - 2, radius + 2, radius, piecesOfChart);
    }

    _drawPieChart(ctx, x, y, radius, segments) {
        let startAngle = -Math.PI / 2;
        segments.forEach(segment => {
            let angle = startAngle + segment.value * 2 * Math.PI;

            // Dibujamos el segmento
            ctx.setSourceRGBA(...segment.color);
            ctx.moveTo(x, y);
            ctx.arc(x, y, radius, startAngle, angle);
            ctx.closePath();
            ctx.fill();

            startAngle = angle;
        });
    }

    // Método que se ejecuta cuando el applet es eliminado
    on_applet_removed() {
        global.log(`Applet removed: cleaning up resources`);

        // Elimina el timer de actualización para detener el proceso
        if (this._refreshTimer) {
            Mainloop.source_remove(this._refreshTimer);
            this._refreshTimer = null;
        }

        // Limpia cualquier otro recurso que necesite ser liberado
    }
}


function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}

// AUXILIARIES FUNCTIONS

