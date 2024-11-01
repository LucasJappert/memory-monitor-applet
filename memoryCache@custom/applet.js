const Applet = imports.ui.applet;
const Lang = imports.lang;
const St = imports.gi.St;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
const Cairo = imports.cairo;

class MyApplet extends Applet.Applet {
    constructor(metadata, orientation, panel_height, instance_id) {
        super(orientation, panel_height, instance_id);

        // Crear el área de dibujo
        this.drawingArea = new St.DrawingArea();
        this.drawingArea.width = 50;
        this.drawingArea.height = panel_height;
        this.drawingArea.connect("repaint", Lang.bind(this, this._onRepaint));
        this.actor.add(this.drawingArea);

        // Crear el tooltip de Cinnamon
        this.set_applet_tooltip("Cargando información de memoria...");

        // Iniciar el bucle de actualización
        this._update();
    }

    _update() {
        this.memoryData = this._getMemoryUsage();

        // Actualizar el contenido del tooltip
        this._updateTooltip();

        this.drawingArea.queue_repaint();
        Mainloop.timeout_add_seconds(5, Lang.bind(this, this._update));
    }

    _updateTooltip() {
        // Construir el texto para el tooltip con la información de uso de memoria
        let tooltipText = "Memoria en uso:\n";
        for (let process in this.memoryData) {
            if (process !== "available") {
                tooltipText += `${process}: ${(this.memoryData[process] / 1024).toFixed(2)} MB\n`;
            }
        }
        tooltipText += `Disponible: ${(this.memoryData["available"] / 1024).toFixed(2)} MB`;

        // Configurar el texto del tooltip
        this.set_applet_tooltip(tooltipText);
    }

    _getMemoryUsage() {
        let usage = {};
        let [ok, out, err] = GLib.spawn_command_line_sync("sh -c 'ps aux'");
        if (!ok) return usage;

        let lines = out.toString().split("\n");
        lines.forEach(line => {
            let parts = line.trim().split(/\s+/);
            if (parts.length > 5) {
                let command = parts[10];
                let memoryKb = parseFloat(parts[5]) || 0;
                let name = command.split("/").pop();
                if (usage[name]) {
                    usage[name] += memoryKb;
                } else {
                    usage[name] = memoryKb;
                }
            }
        });

        let filteredUsage = {};
        const targetProcesses = ["code", "brave"];
        for (let process in usage) {
            let memoryKb = usage[process];
            if (targetProcesses.includes(process) || memoryKb > 1024 * 1024) {
                filteredUsage[process] = (filteredUsage[process] || 0) + memoryKb;
            }
        }

        let totalUsedMemory = Object.values(filteredUsage).reduce((a, b) => a + b, 0);
        filteredUsage["available"] = (16 * 1024 * 1024) - totalUsedMemory;
        return filteredUsage;
    }

    _onRepaint(area) {
        const width = this.drawingArea.width;
        const height = this.drawingArea.height;
        const ctx = area.get_context();

        ctx.setSourceRGBA(0, 0, 0, 0);
        ctx.rectangle(0, 0, width, height);
        ctx.fill();

        const totalMemory = 16 * 1024 * 1024;
        const colors = {
            "code": [0, 0, 1, 1],
            "brave": [1, 0.5, 0, 1],
            "available": [0, 1, 0, 0.6]
        };

        let x = 0;
        const barWidth = width / Object.keys(this.memoryData).length;

        for (let process in this.memoryData) {
            let memoryKb = this.memoryData[process];
            let barHeight = (memoryKb / totalMemory) * height;
            let color = colors[process] || [0.5, 0.5, 0.5, 1];

            ctx.setSourceRGBA(...color);
            ctx.rectangle(x, height - barHeight, barWidth, barHeight);
            ctx.fill();

            x += barWidth;
        }
    }
}

function main(metadata, orientation, panel_height, instance_id) {
    return new MyApplet(metadata, orientation, panel_height, instance_id);
}
